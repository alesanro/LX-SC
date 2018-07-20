"use strict";

const BalanceHolder = artifacts.require('BalanceHolder');
const ERC20Interface = artifacts.require('ERC20Interface');
const Mock = artifacts.require('Mock');
const Roles2Library = artifacts.require('Roles2Library');
const Roles2LibraryInterface = artifacts.require('Roles2LibraryInterface');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');


contract('BalanceHolder', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  const asserts = Asserts(assert);
  const PaymentGatewayRole = 33;
  let erc20Interface = web3.eth.contract(ERC20Interface.abi).at('0x0');
  let paymentGatewayAddress = accounts[5];
  let balanceHolder;
  let roles2LibraryInterface = web3.eth.contract(Roles2LibraryInterface.abi).at('0x0');
  let mock;

  const assertExpectations = (expected = 0, callsCount = null) => {
    let expectationsCount;
    return () => {
      return mock.expectationsLeft()
      .then(asserts.equal(expected))
      .then(() => mock.expectationsCount())
      .then(result => expectationsCount = result)
      .then(() => mock.callsCount())
      .then(result => asserts.equal(callsCount === null ? expectationsCount : callsCount)(result));
    };
  };

  before('setup', () => {
    return Mock.deployed()
    .then(instance => mock = instance)
    .then(() => BalanceHolder.deployed())
    .then(instance => balanceHolder = instance)
    .then(() => Roles2Library.deployed())
    .then(roles2Library => roles2Library.addUserRole(paymentGatewayAddress, PaymentGatewayRole))
    .then(reverter.snapshot);
  });

  describe("Deposit", () => {

    it('should check auth on deposit', () => {
      const caller = accounts[1];
      const sender = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
      .then(() => balanceHolder.setRoles2Library(Mock.address))
      .then(() => mock.expect(
        balanceHolder.address,
        0,
        roles2LibraryInterface.canCall.getData(
          caller,
          balanceHolder.address,
          balanceHolder.contract.deposit.getData(sender, value, mock.address).slice(0, 10)
        ), 0)
      )
      .then(() => balanceHolder.deposit(sender, value, mock.address, {from: caller}))
      .then(assertExpectations());
    });

    it('should call transferFrom on deposit', () => {
      const sender = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
      .then(() => mock.expect(balanceHolder.address, 0, erc20Interface.transferFrom.getData(sender, balanceHolder.address, value), 0))
      .then(() => balanceHolder.deposit(sender, value, mock.address, {from: paymentGatewayAddress}))
      .then(assertExpectations());
    });

    it('should return transferFrom fail on deposit', () => {
      const sender = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const result = '0x0000000000000000000000000000000000000000000000000000000000000000';
      return Promise.resolve()
      .then(() => mock.expect(
          balanceHolder.address,
          0,
          erc20Interface.transferFrom.getData(sender, balanceHolder.address, value),
          result
      ))
      .then(() => balanceHolder.deposit.call(
        sender, value, mock.address, {from: paymentGatewayAddress})
      )
      .then(asserts.isFalse);
    });

    it('should return transferFrom success on deposit', () => {
      const sender = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const result = '0x0000000000000000000000000000000000000000000000000000000000000001';
      return Promise.resolve()
      .then(() => mock.expect(balanceHolder.address, 0, erc20Interface.transferFrom.getData(sender, balanceHolder.address, value), result))
      .then(() => balanceHolder.deposit.call(sender, value, mock.address, {from: paymentGatewayAddress}))
      .then(asserts.isTrue);
    });

  });

  describe('Withdraw', () => {

    it('should check auth on withdraw', () => {
      const caller = accounts[1];
      const sender = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => balanceHolder.setRoles2Library(Mock.address))
        .then(() => mock.expect(
          balanceHolder.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            balanceHolder.address,
            balanceHolder.contract.withdraw.getData(sender, value, mock.address).slice(0, 10)
          ), 0)
        )
        .then(() => balanceHolder.withdraw(sender, value, mock.address, {from: caller}))
        .then(assertExpectations());
    });

    it('should call transfer on withdraw', () => {
      const receiver = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => mock.expect(balanceHolder.address, 0, erc20Interface.transfer.getData(receiver, value), 0))
        .then(() => balanceHolder.withdraw(receiver, value, mock.address, {from: paymentGatewayAddress}))
        .then(assertExpectations());
    });

    it('should return transfer fail on withdraw', () => {
      const receiver = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const result = '0x0000000000000000000000000000000000000000000000000000000000000000';
      return Promise.resolve()
        .then(() => mock.expect(balanceHolder.address, 0, erc20Interface.transfer.getData(receiver, value), result))
        .then(() => balanceHolder.withdraw.call(receiver, value, mock.address, {from: paymentGatewayAddress}))
        .then(asserts.isFalse);
    });

    it('should return transfer success on withdraw', () => {
      const receiver = '0xffffffffffffffffffffffffffffffffffffffff';
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const result = '0x0000000000000000000000000000000000000000000000000000000000000001';
      return Promise.resolve()
        .then(() => mock.expect(balanceHolder.address, 0, erc20Interface.transfer.getData(receiver, value), result))
        .then(() => balanceHolder.withdraw.call(receiver, value, mock.address, {from: paymentGatewayAddress}))
        .then(asserts.isTrue);
    });

  });

});
