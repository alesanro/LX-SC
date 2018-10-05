"use strict";

const BalanceHolder = artifacts.require('./BalanceHolder.sol');
const JobController = artifacts.require('./JobController.sol');
const Mock = artifacts.require('./Mock.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');
const PaymentProcessor = artifacts.require('./PaymentProcessor.sol');
const Storage = artifacts.require('./Storage.sol');
const UserLibrary = artifacts.require('./UserLibrary.sol');
const BoardController = artifacts.require('./BoardController.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');
const eventsHelper = require('./helpers/eventsHelper');
const constants = require('./helpers/constants');

const helpers = require('./helpers/helpers');
const ErrorsNamespace = require('../common/errors')

contract('BoardController', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  const asserts = Asserts(assert);

  let storage;
  let boardController;
  let jobController;
  let multiEventsHistory;
  let paymentProcessor;
  let userLibrary;
  let paymentGateway;
  let balanceHolder;
  let roles2Library;
  let mock;
  let createBoard;
  let closeBoard;

  const root = accounts[5];
  const moderator = accounts[6];
  const moderator2 = accounts[7];
  const stranger = accounts[9];
  const client = accounts[1];

  const role = 44;

  const boardId = 1;
  const boardTags = 1;
  const boardTagsArea = 1;
  const boardTagsCategory = 1;
  const boardIpfsHash = 'boardIpfsHash';

  const jobId = 1;
  const jobArea = 4;
  const jobCategory = 4;
  const jobSkills = 4;
  const jobDefaultPay = 90;
  const jobDetails = 'Job details';
  const jobFlow = web3.toBigNumber(2).pow(255).add(1) /// WORKFLOW_TM + CONFIRMATION

  before('setup', () => {
    return Mock.deployed()
    .then(instance => mock = instance)
    .then(() => MultiEventsHistory.deployed())
    .then(instance => multiEventsHistory = instance)
    .then(() => Storage.deployed())
    .then(instance => storage = instance)
    .then(() => BalanceHolder.deployed())
    .then(instance => balanceHolder = instance)
    .then(() => UserLibrary.deployed())
    .then(instance => userLibrary = instance)
    .then(() => Roles2Library.deployed())
    .then(instance => roles2Library = instance)
    .then(() => PaymentGateway.deployed())
    .then(instance => paymentGateway = instance)
    .then(() => PaymentProcessor.deployed())
    .then(instance => paymentProcessor = instance)
    .then(() => JobController.deployed())
    .then(instance => jobController = instance)
    .then(() => BoardController.deployed())
    .then(instance => boardController = instance)

    .then(() => paymentGateway.setBalanceHolder(balanceHolder.address))
    .then(() => paymentProcessor.setPaymentGateway(paymentGateway.address))

    .then(() => jobController.setPaymentProcessor(paymentProcessor.address))
    .then(() => jobController.setUserLibrary(mock.address))

    .then(() => createBoard = boardController.contract.createBoard.getData(0,0,0,0).slice(0,10))
    .then(() => closeBoard = boardController.contract.closeBoard.getData(0).slice(0,10))

    .then(() => roles2Library.setRootUser(root, true))
    .then(() => roles2Library.addRoleCapability(role, boardController.address, createBoard))
    .then(() => roles2Library.addRoleCapability(role, boardController.address, closeBoard))
    .then(() => roles2Library.addUserRole(moderator, role, {from: root}))

    .then(reverter.snapshot);
  });

  describe('#getBoards', () => {

    it('should filter by creator', async () => {

      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, boardIpfsHash, { from: moderator });

      const result1 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result1.removeZeros().length, 1);

      const result2 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        moderator,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result2.removeZeros().length, 1);

      const result3 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        client,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result3.removeZeros().length, 0);

    });

    it('should filter by status', async () => {

      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, boardIpfsHash, { from: moderator });

      const result1 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result1.removeZeros().length, 1);

      const result2 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_OPENED_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result2.removeZeros().length, 1);

      const result3 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_CLOSED_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result3.removeZeros().length, 0);

      await boardController.closeBoard(boardId, { from: moderator });

      const result4 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_CLOSED_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result4.removeZeros().length, 1);

    });

    it('should filter by area mask', async () => {

      const result1 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result1.removeZeros().length, 0);

      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(1), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(2), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });

      const result2 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result2.removeZeros().length, 3);

      const result3 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(0),
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result3.removeZeros().length, 1);

      const result4 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(1),
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result4.removeZeros().length, 1);

      const result5 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(2),
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result5.removeZeros().length, 1);

      const result6 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(0) | helpers.getOddFlag(1),
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result6.removeZeros().length, 2);

      const result7 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(0) | helpers.getOddFlag(1) | helpers.getOddFlag(2),
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result7.removeZeros().length, 3);

    });

    it('should filter by category mask', async () => {

      const result1 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result1.removeZeros().length, 0);

      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(1), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(2), boardIpfsHash, { from: moderator });

      const result2 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result2.removeZeros().length, 3);

      const result3 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(0),
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result3.removeZeros().length, 1);

      const result4 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(1),
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result4.removeZeros().length, 1);

      const result5 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(2),
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result5.removeZeros().length, 1);

      const result6 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(0) | helpers.getOddFlag(1),
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result6.removeZeros().length, 2);

      const result7 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        helpers.getOddFlag(0) | helpers.getOddFlag(1) | helpers.getOddFlag(2),
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result7.removeZeros().length, 3);

    });

    it('should filter by skills mask', async () => {

      const result1 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result1.removeZeros().length, 0);

      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(1), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(2), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });

      const result2 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result2.removeZeros().length, 3);

      const result3 = await boardController.getBoards(
        helpers.getBitFlag(0),
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result3.removeZeros().length, 1);

      const result4 = await boardController.getBoards(
        helpers.getBitFlag(1),
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result4.removeZeros().length, 1);

      const result5 = await boardController.getBoards(
        helpers.getBitFlag(2),
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result5.removeZeros().length, 1);

      const result6 = await boardController.getBoards(
        helpers.getBitFlag(0) | helpers.getBitFlag(1),
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result6.removeZeros().length, 2);

      const result7 = await boardController.getBoards(
        helpers.getBitFlag(0) | helpers.getBitFlag(1) | helpers.getBitFlag(2),
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result7.removeZeros().length, 3);

    });

    it('should paginate', async () => {

      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });

      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });

      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });
      await boardController.createBoard(helpers.getBitFlag(0), helpers.getOddFlag(0), helpers.getOddFlag(0), boardIpfsHash, { from: moderator });

      const result1 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result1.removeZeros().length, 9);

      const result2 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        constants.FROM_DEFAULT,
        5,
      );
      assert.equal(result2.removeZeros().length, 5);

      const result3 = await boardController.getBoards(
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.TAG_ALL_BIT_MASK,
        constants.BOARD_CREATOR_ALL_FLAG,
        constants.BOARD_STATUS_ALL_FLAG,
        5,
        constants.TAKE_DEFAULT,
      );
      assert.equal(result3.removeZeros().length, 5);

    });

  });

  describe('#isBoardExists', () => {

    it('should return false if boardId less than 1', async () => {
      const result = await boardController.isBoardExists(0);
      asserts.isFalse(result);
    });

    it('should return false if boardId greater than board count', async () => {
      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator})
      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator})
      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator})
      const result = await boardController.isBoardExists(4);
      asserts.isFalse(result);
    });

    it('should return true if boardId exists', async () => {
      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator})
      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator})
      await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator})
      const result1 = await boardController.isBoardExists(1);
      const result2 = await boardController.isBoardExists(2);
      const result3 = await boardController.isBoardExists(3);
      asserts.isTrue(result1);
      asserts.isTrue(result2);
      asserts.isTrue(result3);
    });

  });

  describe('Board creating', () => {
    it('should allow to create a board by moderator', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(1));
    });

    it('should allow to create a board by root', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: root}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(1));
    });

    it('should allow to create a board several times by different moderators', () => {
      return Promise.resolve()
        .then(() => roles2Library.addUserRole(moderator2, role, {from: root}))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator2}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(2));
    });

    it('should allow to create a board several times by root and moderator', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: root}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(2));
    });

    it.skip('should NOT allow to create a board by strangers', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard.call(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: stranger}))
        .then(asserts.equal(0));
    });

    it.skip('should NOT allow to create a board with negative tags', () => {
      const negativeTags = -1;
      return Promise.resolve()
        .then(() => boardController.createBoard(negativeTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(0));
    });

    it('should NOT allow to create a board with negative area', () => {
      const negativeArea = -1;
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, negativeArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(0));
    });

    it('should NOT allow to create a board with negative category', () => {
      const negativeCategory = -1;
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, negativeCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(0));
    });

    it('should NOT allow to create a board without tags', () => {
      const zeroTag = 0;
      return Promise.resolve()
        .then(() => boardController.createBoard(zeroTag, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(0));
    });

    it('should allow to create a board after failed trying', () => {
      const zeroTag = 0;
      return Promise.resolve()
        .then(() => boardController.createBoard(zeroTag, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.getBoardsCount())
        .then(asserts.equal(1));
    });

    it('should emit "BoardCreated" event', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(tx => eventsHelper.extractEvents(tx, "BoardCreated"))
        .then(events => {
            assert.equal(events.length, 1);
            let boardCreatedEvent = events[0];

            assert.equal(boardCreatedEvent.address, multiEventsHistory.address);
            assert.equal(boardCreatedEvent.event, 'BoardCreated');
            const log = boardCreatedEvent.args;            
            assert.equal(log.self, boardController.address);
            assert.equal(log.boardId.toString(), '1');
            assert.equal(log.boardTags.toString(), boardTags);
            assert.equal(log.boardTagsArea.toString(), boardTagsArea);
            assert.equal(log.boardTagsCategory.toString(), boardTagsCategory);
            // TODO: ahiatsevich: check name/description/ipfshash
        })
    });

  });

  describe('Job binding', () => {

    it('should allow to bind job on board', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => jobController.postJob(jobFlow, jobArea, jobCategory, jobSkills, jobDefaultPay, jobDetails, {from: client}))
        .then(() => boardController.bindJobWithBoard(boardId, jobId))
        .then(() => boardController.getJobStatus(boardId, jobId))
        .then(asserts.equal(true));
    });

    it('should NOT allow to bind job on closed board', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => jobController.postJob(jobFlow, jobArea, jobCategory, jobSkills, jobDefaultPay, jobDetails, {from: client}))
        .then(() => boardController.closeBoard(boardId, {from: moderator}))
        .then(() => boardController.bindJobWithBoard.call(boardId, jobId))
        .then((code) => assert.equal(code, ErrorsNamespace.BOARD_CONTROLLER_BOARD_IS_CLOSED));
    });

    it('should NOT allow to bind binded job on other board', () => {
      const boardId2 = 2;
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => jobController.postJob(jobFlow, jobArea, jobCategory, jobSkills, jobDefaultPay, jobDetails, {from: client}))
        .then(() => boardController.bindJobWithBoard(boardId, jobId))
        .then(() => boardController.bindJobWithBoard.call(boardId2, jobId))
        .then((code) => assert.equal(code.toNumber(), ErrorsNamespace.BOARD_CONTROLLER_JOB_IS_ALREADY_BINDED));
    });

    it('should NOT allow to bind binded job on same board twice', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => jobController.postJob(jobFlow, jobArea, jobCategory, jobSkills, jobDefaultPay, jobDetails, {from: client}))
        .then(() => boardController.bindJobWithBoard(boardId, jobId))
        .then(() => boardController.bindJobWithBoard.call(boardId, jobId))
        .then((code) => assert.equal(code.toNumber(), ErrorsNamespace.BOARD_CONTROLLER_JOB_IS_ALREADY_BINDED));
    });

    it('should emit "Job Binded" event', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => jobController.postJob(jobFlow, jobArea, jobCategory, jobSkills, jobDefaultPay, jobDetails, {from: client}))
        .then(() => boardController.bindJobWithBoard(boardId, jobId))
        .then(tx => {
          assert.equal(tx.logs.length, 1);
          assert.equal(tx.logs[0].address, multiEventsHistory.address);
          assert.equal(tx.logs[0].event, 'JobBinded');
          const log = tx.logs[0].args;
          assert.equal(log.self, boardController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.boardId.toString(), '1');
          assert.equal(log.status, true);
        })
    });
  });

  describe('User binding', () => {

    it('should allow to bind user on board', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.bindUserWithBoard(boardId, client))
        .then(() => boardController.getUserStatus(boardId, client))
        .then(asserts.equal(true));
    });

    it('should allow to bind user not only on one board', () => {
      const boardId2 = 2;
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.bindUserWithBoard(boardId, client))
        .then(() => boardController.bindUserWithBoard(boardId2, client))
        .then(() => boardController.getUserStatus(boardId, client))
        .then(asserts.equal(true))
        .then(() => boardController.getUserStatus(boardId2, client))
        .then(asserts.equal(true));
    });

    it('should NOT allow to bind user on closed board', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.closeBoard(boardId, {from: moderator}))
        .then(() => boardController.bindUserWithBoard.call(boardId, client))
        .then((code) => assert.equal(code, ErrorsNamespace.BOARD_CONTROLLER_BOARD_IS_CLOSED))
    });

    it('should NOT allow to bind binded user on same board twice', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.bindUserWithBoard(boardId, client))
        .then(() => boardController.bindUserWithBoard.call(boardId, client))
        .then((code) => assert.equal(code, ErrorsNamespace.BOARD_CONTROLLER_USER_IS_ALREADY_BINDED))
    });

    it('should emit "User Binded" event', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.bindUserWithBoard(boardId, client))
        .then(tx => {
          assert.equal(tx.logs.length, 1);
          assert.equal(tx.logs[0].address, multiEventsHistory.address);
          assert.equal(tx.logs[0].event, 'UserBinded');
          const log = tx.logs[0].args;
          assert.equal(log.self, boardController.address);
          assert.equal(log.user.toString(), client);
          assert.equal(log.boardId.toString(), '1');
          assert.equal(log.status, true);
        })
    });

    it("should allow to unbind user from bound board", async () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.bindUserWithBoard(boardId, client))
        .then(() => boardController.getUserStatus(boardId, client))
        .then(asserts.equal(true))
        .then(() => boardController.unbindUserFromBoard(boardId, client))
        .then(() => boardController.getUserStatus(boardId, client))
        .then(asserts.equal(false))
    })

    it("should not be able to unbind user from not bound board", async () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.getUserStatus(boardId, client))
        .then(asserts.equal(false))
        .then(() => boardController.unbindUserFromBoard(boardId, client))
        .then(() => boardController.getUserStatus(boardId, client))
        .then(asserts.equal(false))
    })

    it('should emit "UserBinded(status=false)" event with when unbind user', () => {
      return Promise.resolve()
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.bindUserWithBoard(boardId, client))
        .then(() => boardController.unbindUserFromBoard(boardId, client))
        .then(tx => {
          assert.equal(tx.logs.length, 1);
          assert.equal(tx.logs[0].address, multiEventsHistory.address);
          assert.equal(tx.logs[0].event, 'UserBinded');
          const log = tx.logs[0].args;
          assert.equal(log.self, boardController.address);
          assert.equal(log.user.toString(), client);
          assert.equal(log.boardId.toString(), boardId.toString());
          assert.equal(log.status, false);
        })
    });
  });

  describe('Board closing', () => {

    it('should allow to close board', () => {
      return Promise.resolve()
        .then(() => roles2Library.setRootUser(root, true))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.closeBoard(boardId, {from: root}))
        .then(() => boardController.getBoardStatus(boardId))
        .then(asserts.equal(false));
    });

    it.skip('should NOT allow to close board not by root', () => {
      return Promise.resolve()
        .then(() => roles2Library.setRootUser(root, true))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.closeBoard(boardId, {from: moderator}))
        .then(() => boardController.getBoardStatus.call(boardId))
        .then(asserts.equal(true));
    });

    it('should NOT allow to close board twice', () => {
      return Promise.resolve()
        .then(() => roles2Library.setRootUser(root, true))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.closeBoard(boardId, {from: root}))
        .then(() => boardController.closeBoard.call(boardId, {from: root}))
        .then((code) => assert.equal(code, ErrorsNamespace.BOARD_CONTROLLER_BOARD_IS_CLOSED))
    });

    it('should emit "Boaed Closed" event', () => {
      return Promise.resolve()
        .then(() => roles2Library.setRootUser(root, true))
        .then(() => boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", {from: moderator}))
        .then(() => boardController.closeBoard(boardId, {from: root}))
        .then(tx => eventsHelper.extractEvents(tx, "BoardClosed"))
        .then(events => {
            assert.equal(events.length, 1);
            let boardClosedEvent = events[0];

            assert.equal(boardClosedEvent.address, multiEventsHistory.address);
            assert.equal(boardClosedEvent.event, 'BoardClosed');
            const log = boardClosedEvent.args;
            assert.equal(log.self, boardController.address);
            assert.equal(log.boardId.toString(), '1');
            assert.equal(log.status, false);
        })
    });

  });

  describe("board filters", () => {

    context("get all boards", () => {
      it("should return no boards before their creation", async () => {
        assert.equal((await boardController.getBoardsCount.call()).toNumber(), 0)

        const emptyBoardsList = await boardController.getBoards(
          boardTags,
          boardTagsArea,
          boardTagsCategory,
          constants.BOARD_CREATOR_ALL_FLAG,
          constants.BOARD_STATUS_ALL_FLAG,
          constants.FROM_DEFAULT,
          constants.TAKE_DEFAULT,
        );
        assert.lengthOf(emptyBoardsList.removeZeros(), 0)
      })

      const otherBoardTag = 5;

      it("should return created boards only if filter conditions are fulfilled", async () => {

        await roles2Library.setRootUser(root, true);
        await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", { from: moderator, });

        const result1 = await boardController.getBoards.call(
          boardTags,
          boardTagsArea,
          boardTagsCategory,
          constants.BOARD_CREATOR_ALL_FLAG,
          constants.BOARD_STATUS_ALL_FLAG,
          constants.FROM_DEFAULT,
          constants.TAKE_DEFAULT,
        );
        assert.lengthOf(result1.removeZeros(), 1);

        const result2 = await boardController.getBoards.call(
          0,
          boardTagsArea,
          boardTagsCategory,
          constants.BOARD_CREATOR_ALL_FLAG,
          constants.BOARD_STATUS_ALL_FLAG,
          constants.FROM_DEFAULT,
          constants.TAKE_DEFAULT,
        );
        assert.lengthOf(result2.removeZeros(), 0);

        await boardController.createBoard(otherBoardTag, boardTagsArea, boardTagsCategory, "boardIpfsHash", { from: moderator, });

        const result3 = await boardController.getBoards.call(
          boardTags,
          boardTagsArea,
          boardTagsCategory,
          constants.BOARD_CREATOR_ALL_FLAG,
          constants.BOARD_STATUS_ALL_FLAG,
          constants.FROM_DEFAULT,
          constants.TAKE_DEFAULT,
        );
        assert.lengthOf(result3.removeZeros(), 2);
      
        const filteredBoardTag = 4

        const result4 = await boardController.getBoards.call(
          filteredBoardTag,
          boardTagsArea,
          boardTagsCategory,
          constants.BOARD_CREATOR_ALL_FLAG,
          constants.BOARD_STATUS_ALL_FLAG,
          constants.FROM_DEFAULT,
          constants.TAKE_DEFAULT,
        );
        assert.lengthOf(result4.removeZeros(), 1);

      });

    });

    context("get only bound users's boards", () => {

      it("should allow to get users's boards", async () => {
        await roles2Library.setRootUser(root, true)
        await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", { from: moderator, })
        await boardController.bindUserWithBoard(1, moderator);

        const result1 = await boardController.getBoardsForUser.call(moderator, boardTags, boardTagsArea, boardTagsCategory, constants.BOARD_CREATOR_ALL_FLAG, constants.BOARD_STATUS_ALL_FLAG);
        assert.lengthOf(result1.removeZeros(), 1);

        const result2 = await boardController.getBoardsForUser.call(root, boardTags, boardTagsArea, boardTagsCategory, constants.BOARD_CREATOR_ALL_FLAG, constants.BOARD_STATUS_ALL_FLAG)
        assert.lengthOf(result2.removeZeros(), 0);

      });
      
      it("should allow to get boards for different clients", async () => {
        await roles2Library.setRootUser(root, true);
        await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", { from: moderator, });
        await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", { from: moderator, });

        const result1 = await boardController.getBoardsCount.call();
        assert.equal(result1.toNumber(), 2);

        await boardController.bindUserWithBoard(1, moderator)
        await boardController.bindUserWithBoard(1, client)

        const result2 = await boardController.getBoardsForUser.call(moderator, boardTags, boardTagsArea, boardTagsCategory, constants.BOARD_CREATOR_ALL_FLAG, constants.BOARD_STATUS_ALL_FLAG);
        assert.lengthOf(result2.removeZeros(), 1);

        const result3 = await boardController.getBoardsForUser.call(client, boardTags, boardTagsArea, boardTagsCategory, constants.BOARD_CREATOR_ALL_FLAG, constants.BOARD_STATUS_ALL_FLAG);
        assert.lengthOf(result3.removeZeros(), 1);

      });

      it("should allow to get board details by id", async () => {
        const otherBoardTags = 7
        const otherBoardName = "Second board"
        await roles2Library.setRootUser(root, true)

        await boardController.createBoard(boardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash", { from: moderator, })
        await boardController.createBoard(otherBoardTags, boardTagsArea, boardTagsCategory, "boardIpfsHash2", { from: moderator, })

        const [ ids,, ipfsHashes, tags, ] = await boardController.getBoardsByIds.call([ 1,2, ])
        assert.lengthOf(ids, 2)
        assert.lengthOf(ipfsHashes, 2)
        assert.equal(ids[0], 1)
        assert.equal(ids[1], 2)
        assert.equal(tags[0], boardTags)
        assert.equal(tags[1], otherBoardTags)
      })
    })
  })

});
