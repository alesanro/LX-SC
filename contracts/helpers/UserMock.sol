pragma solidity 0.4.8;

contract UserMock {
	address public contractOwner;    
	uint public recoverUserCalls;

    function recoverUser(address _newAddress) returns(bool) {
    	recoverUserCalls++;
    	return true;
    }

    function setContractOwner(address _newOwner) returns(bool){
    	contractOwner = _newOwner;
    	return true;
    }

}