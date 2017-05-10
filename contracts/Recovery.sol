pragma solidity 0.4.8;

import './User.sol';
import './Owned.sol';

contract Recovery is Owned {

    function recoverUser(User userContract, address newAddress) onlyContractOwner() returns(bool) {
        userContract.recoverUser(newAddress);
        return true;
    }

}