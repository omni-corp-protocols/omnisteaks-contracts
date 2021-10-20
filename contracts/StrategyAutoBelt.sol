// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./ERC20.sol";
import "./SafeERC20.sol";
import "./SafeMath.sol";

import "./IUniswap.sol";
import "./FeeManager.sol";
import "./StratManager.sol";
import "./GasThrottler.sol";


interface IAutoFarmV2 {
    function poolInfo(uint256 _pid) external view returns (address, uint256, uint256, uint256, address);
    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);
    function pendingAUTO(uint256 _pid, address _user) external view returns (uint256);
    function stakedWantTokens(uint256 _pid, address _user) external view returns (uint256);
    function deposit(uint256 _pid, uint256 _wantAmt) external;
    function withdraw(uint256 _pid, uint256 _wantAmt) external;
    function withdrawAll(uint256 _pid) external;
    function emergencyWithdraw(uint256 _pid) external;
}

interface IBeltToken {
    function token() external view returns (address);
    function deposit(uint256 amount, uint256 min_mint_amount) external;
}

contract StrategyAutoBelt is StratManager, FeeManager, GasThrottler {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Tokens used
    address constant public wbnb = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    address constant public Auto = address(0xa184088a740c695E156F91f5cC086a06bb78b827);
    address public want;
    address public wantToken;

    // Third party contracts
    address constant public autofarm = address(0x0895196562C7868C5Be92459FaE7f877ED450452);
    uint256 public poolId;

    bool public harvestOnDeposit;
    uint256 public lastHarvest;

    // Routes
    address[] public AutoToWbnbRoute = [Auto, wbnb];
    address[] public AutoToWantTokenRoute;


    /**
     * @dev If rewards are locked in AutoFarm, retire() will use emergencyWithdraw.
     */
    bool public rewardsLocked = false;

    /**
     * @dev Event that is fired each time someone harvests the strat.
     */
    event StratHarvest(address indexed harvester);

    constructor(
        address _want,
        uint256 _poolId,
        address _vault,
        address _unirouter,
        address _keeper,
        address _strategist,
        address _platformFeeRecipient,
        address _gasPrice
    ) public StratManager(_keeper, _strategist, _unirouter, _vault, _platformFeeRecipient) GasThrottler(_gasPrice) {
        want = _want;
        wantToken = IBeltToken(want).token();
        poolId = _poolId;

        if (wantToken == wbnb) {
            AutoToWantTokenRoute = [Auto, wbnb];
        } else {
            AutoToWantTokenRoute = [Auto, wbnb, wantToken];
        }

        _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            IAutoFarmV2(autofarm).deposit(poolId, wantBal);
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            IAutoFarmV2(autofarm).withdraw(poolId, _amount.sub(wantBal));
            wantBal = IERC20(want).balanceOf(address(this));
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        if (tx.origin == owner() || paused()) {
            IERC20(want).safeTransfer(vault, wantBal);
        } else {
            uint256 withdrawalFeeAmount = wantBal.mul(withdrawalFee).div(MAX_FEE);
            IERC20(want).safeTransfer(vault, wantBal.sub(withdrawalFeeAmount));
        }
    }

    // compounds earnings and charges performance fee
    function harvest() external whenNotPaused onlyEOA gasThrottle {
        IAutoFarmV2(autofarm).deposit(poolId, 0);
        chargeFees();
        addLiquidity();
        deposit();

        lastHarvest = block.timestamp;
        emit StratHarvest(msg.sender);
    }

    // performance fees
    function chargeFees() internal {
        uint256 toWbnb = IERC20(Auto).balanceOf(address(this)).mul(totalHarvestFee).div(MAX_FEE);
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(toWbnb, 0, AutoToWbnbRoute, address(this), now);

        uint256 wbnbBal = IERC20(wbnb).balanceOf(address(this));

        uint256 callFeeAmount = wbnbBal.mul(callFee).div(MAX_FEE);
        // solhint-disable-next-line
        IERC20(wbnb).safeTransfer(tx.origin, callFeeAmount);

        uint256 platformFeeAmount = wbnbBal.mul(platformFee()).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(platformFeeRecipient, platformFeeAmount);

        uint256 strategistFeeAmount = wbnbBal.mul(strategistFee).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(strategist, strategistFeeAmount);
    }

    // Adds liquidity to AMM and gets more LP tokens.
    function addLiquidity() internal {
        uint256 autoBal = IERC20(Auto).balanceOf(address(this));
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(autoBal, 0, AutoToWantTokenRoute, address(this), now);

        uint256 wantTokenBal = IERC20(wantToken).balanceOf(address(this));
        IBeltToken(want).deposit(wantTokenBal, 0);
    }

    // calculate the total underlaying 'want' held by the strat.
    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    // it calculates how much 'want' this contract holds.
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    // it calculates how much 'want' the strategy has working in the farm.
    function balanceOfPool() public view returns (uint256) {
        return IAutoFarmV2(autofarm).stakedWantTokens(poolId, address(this));
    }

    //added for set withdraw fee
    function setHarvestOnDeposit(bool _harvestOnDeposit) external onlyManager {
        harvestOnDeposit = _harvestOnDeposit;

        if (harvestOnDeposit == true) {
            super.setWithdrawalFee(0);
        } else {
            super.setWithdrawalFee(10);
        }
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
    function retireStrat() external {
        require(msg.sender == vault, "!vault");
        if (rewardsLocked) {
            _retireStratEmergency();
        } else {
            _retireStrat();
        }
    }

    function setRewardsLocked(bool _rewardsLocked) external onlyOwner {
        rewardsLocked = _rewardsLocked;
    }

    function _retireStrat() internal {
        IAutoFarmV2(autofarm).withdraw(poolId, uint(-1));

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    function _retireStratEmergency() internal {
        IAutoFarmV2(autofarm).emergencyWithdraw(poolId);

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        IAutoFarmV2(autofarm).withdraw(poolId, uint(-1));
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panicEmergency() public onlyManager {
        pause();
        IAutoFarmV2(autofarm).emergencyWithdraw(poolId);
    }

    function pause() public onlyManager {
        _pause();

        _removeAllowances();
    }

    function unpause() external onlyManager {
        _unpause();

        _giveAllowances();

        deposit();
    }

    function _giveAllowances() internal {
        IERC20(want).safeApprove(autofarm, uint(-1));
        IERC20(Auto).safeApprove(unirouter, uint(-1));
        IERC20(wantToken).safeApprove(want, uint(-1));
    }

    function _removeAllowances() internal {
        IERC20(want).safeApprove(autofarm, 0);
        IERC20(Auto).safeApprove(unirouter, 0);
        IERC20(wantToken).safeApprove(want, 0);
    }
}