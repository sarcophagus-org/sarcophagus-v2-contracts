// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LibAppStorage.sol";

contract AppStorageInit {
    /// @notice Initializes the app with default state values
    /// @dev Add any AppStorage struct properties here to initialize values
    function init(IERC20 sarcoToken) external {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Add the ERC20 token to app storage (Sarco)
        s.sarcoToken = sarcoToken;
    }
}
