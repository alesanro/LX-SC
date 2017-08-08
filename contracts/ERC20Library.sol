pragma solidity 0.4.8;

import './adapters/MultiEventsHistoryAdapter.sol';
import './adapters/Roles2LibraryAdapter.sol';
import 'solidity-storage-lib/contracts/StorageAdapter.sol';


contract ERC20Library is StorageAdapter, MultiEventsHistoryAdapter, Roles2LibraryAdapter {
    StorageInterface.AddressesSet contracts;

    event ContractAdded(address indexed self, address indexed contractAddress);
    event ContractRemoved(address indexed self, address indexed contractAddress);

    function ERC20Library(Storage _store, bytes32 _crate, address _roles2Library)
        StorageAdapter(_store, _crate)
        Roles2LibraryAdapter(_roles2Library)
    {
        contracts.init('contracts');
    }

    function setupEventsHistory(address _eventsHistory) auth() returns(bool) {
        if (getEventsHistory() != 0x0) {
            return false;
        }
        _setEventsHistory(_eventsHistory);
        return true;
    }

    function count() constant returns(uint) {
        return store.count(contracts);
    }

    function includes(address _contract) constant returns(bool) {
        return store.includes(contracts, _contract);
    }

    function getContracts() constant returns(address[]) {
        return store.get(contracts);
    }

    function getContract(uint _index) constant returns(address) {
        return store.get(contracts, _index);
    }

    function addContract(address _address) auth() returns(bool) {
        store.add(contracts, _address);
        _emitContractAdded(_address);
        return true;
    }

    function removeContract(address _address) auth() returns(bool) {
        store.remove(contracts, _address);
        _emitContractRemoved(_address);
        return true;
    }

    function _emitContractAdded(address _address) internal {
        ERC20Library(getEventsHistory()).emitContractAdded(_address);
    }

    function _emitContractRemoved(address _address) internal {
        ERC20Library(getEventsHistory()).emitContractRemoved(_address);
    }

    function emitContractAdded(address _address) {
        ContractAdded(_self(), _address);
    }

    function emitContractRemoved(address _address) {
        ContractRemoved(_self(), _address);
    }
}
