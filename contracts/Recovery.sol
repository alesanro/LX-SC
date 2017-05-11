pragma solidity 0.4.8;

import './User.sol';
import './Owned.sol';

contract Recovery is Owned {

    event UserRecovered(address prevUser, address newUser, User userContract);

    function recoverUser(User _userContract, address _newAddress) onlyContractOwner() returns(bool) {
        if (!_userContract.recoverUser(_newAddress)){
            throw;
        }
        UserRecovered(_userContract.contractOwner(), _newAddress, _userContract);
        return true;
    }

}
