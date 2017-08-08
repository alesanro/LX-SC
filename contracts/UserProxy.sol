pragma solidity 0.4.8;

import 'solidity-shared-lib/contracts/Owned.sol';


contract UserProxy is Owned {
    event Forwarded (
        address indexed destination,
        uint value,
        bytes data
    );
    event Received (
        address indexed sender,
        uint value
    );

    function () payable {
        Received(msg.sender, msg.value);
    }

    function forward(
        address _destination,
        bytes _data,
        uint _value,
        bool _throwOnFailedCall
    )
        onlyContractOwner()
    returns(bytes32 result) {
        bool success;
        assembly {
            success := call(div(mul(gas, 63), 64), _destination, _value, add(_data, 32), mload(_data), 0, 32)
            result := mload(0)
        }
        if (!success && _throwOnFailedCall) {
            throw;
        }
        Forwarded(_destination, _value, _data);
    }
}
