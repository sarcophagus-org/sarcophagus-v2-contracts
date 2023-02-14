// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LibAppStorage.sol";

contract AppStorageInit {
    /// @notice Initializes the app with default state values
    /// @dev Add any AppStorage struct properties here to initialize values
    function init(
        IERC20 sarcoToken,
        uint256 protocolFeeBasePercentage,
        uint256 gracePeriod,
        uint256 embalmerClaimWindow,
        uint256 expirationThreshold
    ) external {
        AppStorage storage s = LibAppStorage.getAppStorage();

        s.sarcoToken = sarcoToken;
        s.protocolFeeBasePercentage = protocolFeeBasePercentage;
        s.gracePeriod = gracePeriod;
        s.embalmerClaimWindow = embalmerClaimWindow;
        s.expirationThreshold = expirationThreshold;
    }
}
