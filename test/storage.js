"use strict";

const ManagerMock = artifacts.require('./ManagerMock.sol');
const Storage = artifacts.require('solidity-storage-lib/contracts/Storage.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');


contract('Storage', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  const asserts = Asserts(assert);
  let storage;
  let manager;
  const KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const CRATE = 'SomeCrate';

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

  before('setup', () => {
    return Storage.deployed()
    .then(instance => storage = instance)
    .then(() => ManagerMock.deployed())
    .then(instance => manager = instance)
    .then(() => storage.setManager(manager.address))
    .then(reverter.snapshot);
  });

  it('should NOT allow to set storage manager by non-owner');  // TODO

  it('should allow owner to set storage manager');  // TODO

  it('should store uint values', () => {
    const value = web3.toBigNumber('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    return storage.setUInt(CRATE, KEY, value)
    .then(() => storage.getUInt(CRATE, KEY))
    .then(asserts.equal(value));
  });

  it('should store address values', () => {
    const value = '0xffffffffffffffffffffffffffffffffffffffff';
    return storage.setAddress(CRATE, KEY, value)
    .then(() => storage.getAddress(CRATE, KEY))
    .then(asserts.equal(value));
  });

  it('should store bool values', () => {
    const value = true;
    return storage.setBool(CRATE, KEY, value)
    .then(() => storage.getBool(CRATE, KEY))
    .then(asserts.equal(value));
  });

  it('should store int values', () => {
    const value = web3.toBigNumber(2).pow(255).sub(1).mul(-1);
    return storage.setInt(CRATE, KEY, value)
    .then(() => storage.getInt(CRATE, KEY))
    .then(asserts.equal(value));
  });

  it('should store bytes32 values', () => {
    const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    return storage.setBytes32(CRATE, KEY, value)
    .then(() => storage.getBytes32(CRATE, KEY))
    .then(asserts.equal(value));
  });

  it('should not store uint values if not allowed', () => {
    const value = web3.toBigNumber('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    return manager.deny()
    .then(() => asserts.throws(storage.setUInt(CRATE, KEY, value)))
    .then(() => storage.getUInt(CRATE, KEY))
    .then(asserts.equal(0));
  });

  it('should not store address values if not allowed', () => {
    const value = '0xffffffffffffffffffffffffffffffffffffffff';
    return manager.deny()
    .then(() => asserts.throws(storage.setAddress(CRATE, KEY, value)))
    .then(() => storage.getAddress(CRATE, KEY))
    .then(asserts.equal(ZERO_ADDRESS));
  });

  it('should not store bool values if not allowed', () => {
    const value = true;
    return manager.deny()
    .then(() => asserts.throws(storage.setBool(CRATE, KEY, value)))
    .then(() => storage.getBool(CRATE, KEY))
    .then(asserts.equal(false));
  });

  it('should not store int values if not allowed', () => {
    const value = web3.toBigNumber(2).pow(255).sub(1).mul(-1);
    return manager.deny()
    .then(() => asserts.throws(storage.setInt(CRATE, KEY, value)))
    .then(() => storage.getInt(CRATE, KEY))
    .then(asserts.equal(0));
  });

  it('should not store bytes32 values if not allowed', () => {
    const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    return manager.deny()
    .then(() => asserts.throws(storage.setBytes32(CRATE, KEY, value)))
    .then(() => storage.getBytes32(CRATE, KEY))
    .then(asserts.equal(ZERO_BYTES32));
  });
});
