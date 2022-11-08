// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./storage/LibAppStorage.sol";
import "./libraries/LibTypes.sol";



contract HeritageAssetWillVault is Ownable {
    
    using SafeERC20 for IERC20;

    // IMPORTANT: AppStorage must be the first state variable.
    AppStorage internal appStorage;

    
    mapping(address => bool) public _beneficiaryStatus; // Mapping to find out easily if an address is a beneficiary of this vault
    LibTypes.BeneficiaryDetails[] public _beneficiaries;
    uint public _beneficiaryCount;
    
    uint256 public _expiryTime;

    mapping(address => bool) _signatoriesStatus; // Mapping to find out easily if an address is a signatory of this vault
    address[] public _signatories;
    uint public _signatoriesCount;

    mapping(address => bool)  _signatorieswhoHaveSignedRelease;
    uint256 public _signatorieswhoHaveSignedReleaseCount;

    bytes32 public _vaultId;
    string public _name;


    

    
    event Deposited(address tokenOrCoin, uint _amount,uint time);
    
    event Refreshed(uint time);

    event SignedRelease(address signatory, uint time);
    
    event Claimed(address beneficiary, uint claimAmount);
    

    mapping(address => bool) public _depositedCoinsStatus; // Mapping to find out easily if a coin is in this contract
    address[] public _depositedCoins;
    
    
    modifier onlyBeneficiary(){
        require(_beneficiaryStatus[msg.sender] == true,"Only beneficiary");
        _;
    }

    modifier onlySignatory(){
        require(_signatoriesStatus[msg.sender] == true,"Only signatory");
        _;
    }
    
    
    constructor(address vaultOwner,bytes32 vaultId,string memory name, LibTypes.BeneficiaryDetails[] memory beneficiaries, address[] memory signatories) payable {
        
        _vaultId=vaultId;
        _name=name;
        _beneficiaryCount=beneficiaries.length;
        for(uint b=0; b< _beneficiaryCount; b++){
            beneficiaries[b].claimed=false;
            _beneficiaries.push(beneficiaries[b]);
            _beneficiaryStatus[beneficiaries[b].beneficiaryAddress] = true;
            // appStorage.beneficiaryVaults[ beneficiaries[b].beneficiaryAddress ].push(vaultId);
        }

        _signatoriesCount=signatories.length;        
        for(uint s=0; s< _signatoriesCount; s++){
            _signatories.push(signatories[s]);
            _signatoriesStatus[signatories[s]] = true;            
        }
        
        _expiryTime= block.timestamp + 30 days;

        _transferOwnership(vaultOwner);

        // appStorage.vaultOwnerVaults[vaultOwner].push(vaultId);
        //Always assume native coin is deposited
        _depositedCoins.push(address(0));
        _depositedCoinsStatus[address(0)]=true;
    }
    
    
    /**
    * @dev Allows the owner to deposit to the contract
    * @notice TokenOrCoin is used to represent the asset to interact with, it should be set tto address(0) to represent the native coin of the chain
    * @param tokenOrCoin The asset to interact with
    * @param amount Amount to Withdraw
    */
    function depositAssets(address tokenOrCoin, uint amount) public payable onlyOwner {
       if(tokenOrCoin == address(0)){
            emit Deposited(address(0), msg.value,block.timestamp);
       }else{
            IERC20(tokenOrCoin).safeTransferFrom(msg.sender, address(this), amount);
            emit Deposited(tokenOrCoin, amount,block.timestamp);

            if(!_depositedCoinsStatus[tokenOrCoin]){
                _depositedCoins.push(tokenOrCoin);
                _depositedCoinsStatus[tokenOrCoin]=true;
            }
       }        
        
    }
    

    // /** Todo - Use AppStorage
    // * @dev Allows the owner to change the beneficiaries
    // * @param newBeneficiaries New Beneficiary List
    // */
    // function changeBeneficiaries(LibTypes.BeneficiaryDetails[] memory newBeneficiaries) public onlyOwner {
    //     // beneficiary=_newInheritor;
    //     delete _beneficiaries;
    //     _beneficiaryCount=newBeneficiaries.length;
    //     for(uint b=0; b< _beneficiaryCount; b++){
    //         _beneficiaries.push(newBeneficiaries[b]);
    //         _beneficiaryStatus[newBeneficiaries[b].beneficiaryAddress] = true;
    //     }
    // }
    
    // //internal function to transfer the beneficiary
    //  function transferInheritor(address _newPerson) internal {
    //     beneficiary=_newPerson;
    // }

    function isSignatory(address signatory) public view returns (bool) {
        return _signatoriesStatus[signatory];
    }    
    
    /**
    * @dev Allows the owner to withdraw from the contract
    * @notice TokenOrCoin is used to represent the asset to interact with, it should be set to address(0) to represent the native coin of the chain
    * @param tokenOrCoin The asset to interact with
    * @param amount Amount to Withdraw
    */
    function withdraw(address tokenOrCoin ,uint amount) public onlyOwner{
        if(tokenOrCoin==address(0)){
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Withdraw failed.");
        }else{
            IERC20(tokenOrCoin).safeTransfer(msg.sender, amount);
        }

    }
    
    
    //internal function to refresh the expirytime
    function refresh() public onlyOwner{
        _expiryTime= block.timestamp + 30 days;
        emit Refreshed(block.timestamp);
    }


    function signToRelease() public onlySignatory{
        address sender = msg.sender;
        require(block.timestamp > _expiryTime, "Expiry Time not reached");// Penalise signatory
        require(!_signatorieswhoHaveSignedRelease[sender], "Release already Signed");

        _signatorieswhoHaveSignedRelease[sender]=true;
        _signatorieswhoHaveSignedReleaseCount++;

        emit SignedRelease(sender, block.timestamp);
    }

    function claim(address tokenOrCoin) public onlyBeneficiary{
        address sender = msg.sender;
        require(block.timestamp > _expiryTime, "Expiry Time not reached");
        require(_signatorieswhoHaveSignedReleaseCount >= _signatoriesCount , "Not Enough Signatories have signed");
        require(_depositedCoinsStatus[tokenOrCoin], "Not enough Coin Balance");

        uint256 balance = _getBalance(tokenOrCoin);
        require(balance > 0, "Not enough Coin Balance");

        LibTypes.BeneficiaryDetails memory benefeciary ;
        uint i;
        for(i=0; i< _beneficiaries.length; i++){
            if(_beneficiaries[i].beneficiaryAddress== sender){
                benefeciary = _beneficiaries[i];
                break;
            }
        }
        require(!benefeciary.claimed, "Already Claimed");

        _beneficiaries[i].claimed=true;
        uint256 claimableBalance = benefeciary.percent * balance / 100;
        _sendCoinTo(sender, tokenOrCoin, claimableBalance);

        emit Claimed(sender, claimableBalance);
    }

    function _getBalance(address tokenOrCoin) private view returns(uint256){
        if(tokenOrCoin==address(0)){
            return address(this).balance;
        }else{
            return IERC20(tokenOrCoin).balanceOf(address(this));
        }
    }

    function _sendCoinTo(address recipient, address tokenOrCoin ,uint amount) private {
        if(tokenOrCoin==address(0)){
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "Send Coin failed.");
        }else{
            IERC20(tokenOrCoin).safeTransfer(recipient, amount);
        }

    }
    
    // //allows the beneficiary to become the owner provided the contract has not been Refreshed for 30 days
    // //resets the _expiryTime to 30days
    // function takeOver(address _newInheritor) public onlyBeneficiary returns (address newInheritor){
    //     require (block.timestamp>=_expiryTime,"contract has not expired");
    //     transferOwnership(msg.sender);
    //     transferInheritor(_newInheritor);
    //     _expiryTime=block.timestamp + 30 days;
    //     return _newInheritor;
    // } 
    
    // //This allows the owner to withdraw zero ether and refresh the contract
    // function withdrawZeroAndRefresh() public onlyOwner{
    //      (bool success, ) = msg.sender.call{value:0}("");
    //     require(success, "Transfer failed.");
    //     refresh();
        
    // }
    
    
    /**
    * @dev Returns the current balance of the contract
    * @notice TokenOrCoin is used to represent the asset to interact with, it should be set tto address(0) to represent the native coin of the chain
    * @param tokenOrCoin The asset to interact with
    */
    function checkBalance(address tokenOrCoin) public view returns(uint){
        if(tokenOrCoin==address(0)){
            return address(this).balance;
        }else{
            return IERC20(tokenOrCoin).balanceOf(address(this));
        }
    }
    
}