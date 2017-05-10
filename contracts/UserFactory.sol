pragma solidity 0.4.8;

import './EventsHistoryAdapter.sol';
import './UserLibrary.sol';
import './UserProxy.sol';
import './Owned.sol';
import './User.sol';

contract UserLibraryInterface {
    function addRole(address _user, bytes32 _role) returns(bool);
    function setMany(address _user, uint _areas, uint[] _categories, uint[] _skills) returns(bool);
}

contract UserFactory is EventsHistoryAdapter, Owned {
    UserLibraryInterface userLibrary;

    event UserCreated(address indexed user, address proxy, address recoveryContract, bytes32[] roles, uint areas, uint[] categories, uint[] skills);

    function createUserWithProxyAndRecovery(address _recoveryContract, bytes32[] _roles, uint _areas, uint[] _categories, uint[] _skills) {
        UserProxy proxy = new UserProxy();
        User user = new User();
        user.setRecoveryContract(_recoveryContract);
        proxy.changeContractOwnership(user);
        user.claimContractOwnership();
        user.setUserProxy(proxy);
        if(!_setRoles(user, _roles)) {
            throw;
        }
        if(!_setSkills(user, _areas, _categories, _skills)) {
            throw;
        }
        UserCreated(user, proxy, _recoveryContract, _roles, _areas, _categories, _skills);
    }

    function setupEventsHistory(address _eventsHistory) onlyContractOwner() returns(bool) {
        if (getEventsHistory() != 0x0) {
            return false;
        }
        _setEventsHistory(_eventsHistory);
        return true;
    }

    function setupUserLibrary(UserLibraryInterface _userLibrary) onlyContractOwner() returns(bool) {
        userLibrary = _userLibrary;
        return true;
    }

    function getUserLibrary() returns(address){
        return userLibrary;
    }

    function _setRoles(address _user, bytes32[] _roles) internal returns(bool){
        for(uint i = 0; i < _roles.length; i++) {
            if(!userLibrary.addRole(_user, _roles[i])) {
                return false;
            }
        }
        return true;
    }

    function _setSkills(address _user, uint _areas, uint[] _categories, uint[] _skills) internal returns(bool){
        if(_areas == 0){
            return true;
        }
        if(!userLibrary.setMany(_user, _areas, _categories, _skills)){
            return false;
        }
        return true;
    }
}
