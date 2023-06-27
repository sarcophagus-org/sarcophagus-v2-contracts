// SPDX-License-Identifier: Unlicense

pragma solidity 0.8.18;

import "../storage/LibAppStorage.sol";

import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";

/// @notice Caller of any function in this facet must be the admin address
contract AdminFacet {
    using SafeERC20 for IERC20;

    event SetProtocolFeeBasePercentage(uint256 protocolFeeBasePercentage);
    event SetCursedBondPercentage(uint256 cursedBondPercentage);
    event WithdrawProtocolFees(uint256 totalProtocolFees, address withdrawalAddress);
    event SetGracePeriod(uint256 gracePeriod);
    event SetEmbalmerClaimWindow(uint256 embalmerClaimWindow);
    event SetExpirationThreshold(uint256 expirationThreshold);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    /// @notice Admin has attempted to set a zero value
    error CannotSetZeroValue();

    /// @notice Caller must be the admin address
    error CallerIsNotAdmin();

    /// @notice Provided address cannot be zero address
    error ZeroAddress();

    /// @notice Withdraws the total protocol fee amount from the contract to the specified address
    /// @param withdrawalAddress - the address to withdraw funds to
    function withdrawProtocolFees(address withdrawalAddress) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        if (msg.sender != s.admin) {
            revert CallerIsNotAdmin();
        }
        // Get the total protocol fees from storage
        uint256 totalProtocolFees = s.totalProtocolFees;
        // Set the total protocol fees to 0 before the transfer to avoid reentrancy
        s.totalProtocolFees = 0;
        // Transfer the protocol fee amount to the sender after setting state
        s.sarcoToken.safeTransfer(withdrawalAddress, totalProtocolFees);
        emit WithdrawProtocolFees(totalProtocolFees, withdrawalAddress);
    }

    /// @notice Sets the protocol fee base percentage, used to calculate protocol fees
    /// @notice The denominator is 10000
    /// @param protocolFeeBasePercentage percentage to set
    function setProtocolFeeBasePercentage(uint256 protocolFeeBasePercentage) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        if (msg.sender != s.admin) {
            revert CallerIsNotAdmin();
        }
        s.protocolFeeBasePercentage = protocolFeeBasePercentage;
        emit SetProtocolFeeBasePercentage(protocolFeeBasePercentage);
    }

    /// @notice Sets the digging fee / cursed bond ratio
    /// @notice The denominator is 10000
    /// used to calculate how much bond archaeologists must lock per curse.
    /// @param cursedBondPercentage ratio to set.
    function setCursedBondPercentage(uint256 cursedBondPercentage) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        if (msg.sender != s.admin) {
            revert CallerIsNotAdmin();
        }
        if (cursedBondPercentage == 0) {
            revert CannotSetZeroValue();
        }
        s.cursedBondPercentage = cursedBondPercentage;
        emit SetCursedBondPercentage(cursedBondPercentage);
    }

    /// @notice Updates the resurrection grace period
    /// @notice Denominated in seconds
    /// @param gracePeriod to set
    function setGracePeriod(uint256 gracePeriod) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        if (msg.sender != s.admin) {
            revert CallerIsNotAdmin();
        }
        s.gracePeriod = gracePeriod;
        emit SetGracePeriod(gracePeriod);
    }

    /// @notice Updates the embalmerClaimWindow
    /// @notice Denominated in seconds
    /// @param embalmerClaimWindow to set
    function setEmbalmerClaimWindow(uint256 embalmerClaimWindow) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        if (msg.sender != s.admin) {
            revert CallerIsNotAdmin();
        }
        s.embalmerClaimWindow = embalmerClaimWindow;
        emit SetEmbalmerClaimWindow(embalmerClaimWindow);
    }

    /// @notice Updates the expirationThreshold used during sarcophagus creation
    /// @notice Denominated in seconds
    /// @param expirationThreshold to set
    function setExpirationThreshold(uint256 expirationThreshold) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        if (msg.sender != s.admin) {
            revert CallerIsNotAdmin();
        }
        s.expirationThreshold = expirationThreshold;
        emit SetExpirationThreshold(expirationThreshold);
    }

    /// @notice Transfers admin address to newAdmin.
    /// @param newAdmin to set
    function transferAdmin(address newAdmin) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        if (msg.sender != s.admin) {
            revert CallerIsNotAdmin();
        }
        if (newAdmin == address(0)) {
            revert ZeroAddress();
        }
        s.admin = newAdmin;
        emit AdminTransferred(msg.sender, newAdmin);
    }
}
