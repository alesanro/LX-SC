pragma solidity 0.4.8;

import './User.sol';
import './Owned.sol';
import './UserProxy.sol';

contract User is Owned {
    UserProxy userProxy;
    address recoveryContract;

    modifier onlyRecoveryContract() {
        if (recoveryContract == msg.sender) {
            _;
        }
    }

    function setUserProxy(UserProxy _userProxy) onlyContractOwner() returns(bool) {
        userProxy = _userProxy;
        return true;
    }

    function getUserProxy() constant returns(address) {
        return userProxy;
    }

    function forward(address _destination, bytes _data, uint _value, bool _throwOnFailedCall) onlyContractOwner() returns(bytes32) {
        return userProxy.forward(_destination, _data, _value, _throwOnFailedCall);
    }

    function setRecoveryContract(address _recoveryContract) onlyContractOwner() returns(bool) {
        recoveryContract = _recoveryContract;
        return true;
    }

    function recoverUser(address newAddress) onlyRecoveryContract() returns(bool) {
        contractOwner = newAddress;
        return true;
    }
        
}
