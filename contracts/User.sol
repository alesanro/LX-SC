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

    //If current contract is the new one that recovers other user contract
    function recoverPreviousUserContract() onlyRecoveryContract() returns(bool) {
        claimContractOwnership();
        return true;
    }

    //If current contract is the one that should be recovered
    function passRigtstoNewUserContract(User newAddress) onlyRecoveryContract() returns(bool) {
        userProxy.changeContractOwnership(newAddress);
        return true;
    }
        
}
