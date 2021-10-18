// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "./ERC20.sol";
import "./SafeERC20.sol";
import "./SafeMath.sol";

import "./IUniswap.sol";
import "./FeeManager.sol";
import "./StratManager.sol";

interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;

    function enterStaking(uint256 _amount) external;

    function leaveStaking(uint256 _amount) external;

    function pendingCake(uint256 _pid, address _user) external view returns (uint256);

    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);

    function emergencyWithdraw(uint256 _pid) external;
}

contract StrategyLinearLina is StratManager, FeeManager {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Tokens used
    address public constant wrapped = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    address public constant want = address(0x762539b45A1dCcE3D36d080F74d1AED37844b878);

    // Third party contracts
    address public constant masterchef = address(0x4151774A7286ae0012cfe506Db5970AF68b2cCE8);

    // Routes
    address[] public wantToWrappedRoute = [want, wrapped];

    /**
     * @dev Event that is fired each time someone harvests the strat.
     */
    event StratHarvest(address indexed harvester, uint256 indexed timestamp);

    constructor(
        address _vault,
        address _unirouter,
        address _keeper,
        address _strategist,
        address _platformFeeRecipient
    ) public StratManager(_keeper, _strategist, _unirouter, _vault, _platformFeeRecipient) {
        _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            IMasterChef(masterchef).enterStaking(wantBal);
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            IMasterChef(masterchef).leaveStaking(_amount.sub(wantBal));
            wantBal = IERC20(want).balanceOf(address(this));
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        // solhint-disable-next-line
        if (tx.origin == owner() || paused()) {
            IERC20(want).safeTransfer(vault, wantBal);
        } else {
            uint256 withdrawalFeeAmount = wantBal.mul(withdrawalFee).div(MAX_FEE);
            IERC20(want).safeTransfer(vault, wantBal.sub(withdrawalFeeAmount));
        }
    }

    function beforeDeposit() external override {
        harvest();
    }

    // compounds earnings and charges performance fee
    function harvest() public whenNotPaused {
        // solhint-disable-next-line
        require(tx.origin == msg.sender || msg.sender == vault, "!contract");
        IMasterChef(masterchef).leaveStaking(0);
        uint256 wantBal = IERC20(want).balanceOf(address(this));
        if (wantBal > 0) {
            chargeFees();
            deposit();
            emit StratHarvest(msg.sender, block.timestamp);
        }
    }

    // performance fees
    function chargeFees() internal {
        uint256 toWrapped = IERC20(want).balanceOf(address(this)).mul(totalHarvestFee).div(MAX_FEE);
        IUniswapRouter(unirouter).swapExactTokensForTokens(toWrapped, 0, wantToWrappedRoute, address(this), now);

        uint256 wrappedBal = IERC20(wrapped).balanceOf(address(this));

        uint256 callFeeAmount = wrappedBal.mul(callFee).div(MAX_FEE);
        // solhint-disable-next-line
        IERC20(wrapped).safeTransfer(tx.origin, callFeeAmount);

        uint256 platformFeeAmount = wrappedBal.mul(platformFee()).div(MAX_FEE);
        IERC20(wrapped).safeTransfer(platformFeeRecipient, platformFeeAmount);

        uint256 strategistFeeAmount = wrappedBal.mul(strategistFee).div(MAX_FEE);
        IERC20(wrapped).safeTransfer(strategist, strategistFeeAmount);
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
        (uint256 _amount, ) = IMasterChef(masterchef).userInfo(0, address(this));
        return _amount;
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        IMasterChef(masterchef).emergencyWithdraw(0);

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        IMasterChef(masterchef).emergencyWithdraw(0);
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
        IERC20(want).safeApprove(masterchef, uint256(-1));
        IERC20(want).safeApprove(unirouter, uint256(-1));
    }

    function _removeAllowances() internal {
        IERC20(want).safeApprove(masterchef, 0);
        IERC20(want).safeApprove(unirouter, 0);
    }
}
