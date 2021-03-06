pragma solidity 0.4.8;

import './User.sol';
import './adapters/Roles2LibraryAdapter.sol';


contract Recovery is Roles2LibraryAdapter {

    event UserRecovered(address prevUser, address newUser, User userContract);

    function Recovery(address _roles2Library) Roles2LibraryAdapter(_roles2Library) {}

    function recoverUser(User _userContract, address _newAddress) auth() returns(bool) {
        address prev = _userContract.contractOwner();
        if (!_userContract.recoverUser(_newAddress)){
            throw;
        }
        UserRecovered(prev, _newAddress, _userContract);
        return true;
    }

}
