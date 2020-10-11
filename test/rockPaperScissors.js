const Promise = require("bluebird");
web3.eth = Promise.promisifyAll(web3.eth);
const {toBN, toWei, utf8ToHex} = web3.utils;
const {getBalance} = web3.eth;
const { constants,time,expectRevert } = require('openzeppelin-test-helpers');
const { shouldFail } = require("openzeppelin-test-helpers");
const RockPaperScissors = artifacts.require("RockPaperScissors");
const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
chai.use(bnChai(BN));



	const ROCK = 1;
	const PAPER = 2;
	const SCISSORS = 3;
	const FIFTEEN_MINUTES = 15 * 60;


	contract('RockPaperScissors - New contract', (accounts) => {
        const [owner, alice, bob] = accounts;
	    const gameDeposit = toWei('4', 'finney');
	    const secretAlice = utf8ToHex("AliceSecret&");
	    let rockPaperScissors;

	    beforeEach('set up rockPaperScissors', async () => {
	        rockPaperScissors = await RockPaperScissors.new({from: owner});
	    });

        // TEST 1
	    it('should allow allice (player1) to commit to a move', async() =>
        {

	        const gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
	        const txObj = await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});

            const LogMoveCommitPlayer1 = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogMoveCommitPlayer1", txObj.logs[0].event);
            assert.strictEqual(LogMoveCommitPlayer1.args.gameId, gameId, "Should have matched with Game Id send");

            assert.strictEqual(LogMoveCommitPlayer1.args.player1, alice, "Should have matched with Player 1");
            assert.strictEqual(LogMoveCommitPlayer1.args.player2, bob, "Should have matched with Player 2");
            assert.strictEqual(LogMoveCommitPlayer1.args.bet.toString(10),gameDeposit.toString(10), "Should have matched with Game deposit send");

            const waitPeriod = await rockPaperScissors.WAITPERIOD();
            assert.equal(waitPeriod.toString(10), '600');

	    });

        // 2nd player is not allowed to commit, the first one has to do it by the rules
	    it('should not allow bob (player2) to make a move', async() =>
        {
	        const gameId = await rockPaperScissors.generateCommitment(bob, PAPER, utf8ToHex("bob's secret"));
	        await expectRevert
            (
	            rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit}),
	            "incorrect player"
	        );
	    });

        it('should allow alice to commit to a move and then bob to make a move', async() =>
        {

   	        const  gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
   	        const txObj1 = await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});
            const LogMoveCommitPlayer1 = txObj1.logs[0];

            assert.strictEqual(txObj1.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogMoveCommitPlayer1", txObj1.logs[0].event);
            assert.strictEqual(LogMoveCommitPlayer1.args.gameId, gameId, "Should have matched with Game Id send");
            assert.strictEqual(LogMoveCommitPlayer1.args.player1, alice, "Should have matched with Player 1");
            assert.strictEqual(LogMoveCommitPlayer1.args.player2, bob, "Should have matched with Player 2");
            assert.strictEqual(LogMoveCommitPlayer1.args.bet.toString(10),gameDeposit.toString(10), "Should have matched with Game deposit send");

   	        const txObj = await rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit});
            const LogMovePlayer2 = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogMovePlayer2",txObj.logs[0].event);
            assert.strictEqual(LogMovePlayer2.args.player, bob);
            assert.strictEqual(LogMovePlayer2.args.gameId, gameId, "Should have matched with Game Id send");
            assert.strictEqual(LogMovePlayer2.args.gameMove.toString(10), PAPER.toString(10), "Should have matched with Game Move send ");
            assert.strictEqual(LogMovePlayer2.args.bet.toString(10), gameDeposit.toString(10), "Should have matched with Game deposit send");

        });

            it('should not allow alice to commit twice', async() =>
            {
       	        const gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
       	        await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});
       	        await expectRevert(
       	            rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit}),
       	            "game id already used"
       	        );
            });
});

// Test 2
    contract('Before expiration', (accounts) =>
    {

        const [owner, alice, bob] = accounts;
        const gameDeposit = toWei('4', 'finney');
        const secretAlice = utf8ToHex("AliceSecret&");
        let rockPaperScissors;
        let gameId;

        beforeEach('set up rockPaperScissors and alice commit to a move', async () =>
        {
            rockPaperScissors = await RockPaperScissors.new({from: owner});
            gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
            await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});
        });


        it('should allow bob to make a move, but not two moves', async() =>
        {
            const txObj = await rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit});
            const LogMovePlayer2 = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogMovePlayer2",txObj.logs[0].event);
            assert.strictEqual(LogMovePlayer2.args.player, bob);
            assert.strictEqual(LogMovePlayer2.args.gameId, gameId, "Should have matched with Game Id send");
            assert.strictEqual(LogMovePlayer2.args.gameMove.toString(10), PAPER.toString(10), "Should have matched with Game Move send ");
            assert.strictEqual(LogMovePlayer2.args.bet.toString(10), gameDeposit.toString(10), "Should have matched with Game deposit send");

            await expectRevert(
            rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit}),
            "player2 has already made a move");

        });

        it('should not allow alice to reclaim the funds before expiration period', async() => {
           await expectRevert(
               rockPaperScissors.player1ReclaimFunds(gameId, {from: alice}),
               "game move not expired yet"
           );
       });


// player 2 didn't make a move yet and experration period did not pass
       it('should not allow alice to reveal move', async() =>
       {
          await expectRevert(
              rockPaperScissors.player1Reveal(ROCK, secretAlice, {from: alice}),
              "player2 has not made a move"
          );
      });

      it("should not run when paused", async() =>
      {

          await rockPaperScissors.pauseContract({from: owner});
          await expectRevert(rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit})
          ,"Pausable: paused");

          await rockPaperScissors.resumeContract({from: owner});
          const txObj = await rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit});

      });

    });

    // Test SET 3
    contract('After expiration', (accounts) =>
    {
        const [owner, alice, bob] = accounts;
        const gameDeposit = toWei('4', 'finney');
        const secretAlice = utf8ToHex("AliceSecret&");
        let gameId;
        let rockPaperScissors;

        before('set up contract and alice commit to a move', async () =>
        {

            rockPaperScissors = await RockPaperScissors.new({from: owner});
            gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
            await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});

        });

        it('should allow alice to reclaim funds after move expiration period', async() =>
        {

            await time.increase(time.duration.minutes(11));

            const txObj = await rockPaperScissors.player1ReclaimFunds(gameId, {from: alice});
            const LogPlayer1ReclaimFunds = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogPlayer1ReclaimFunds", txObj.logs[0].event);
            assert.strictEqual(LogPlayer1ReclaimFunds.args.gameId, gameId, "Should have matched with Game Id send");
            assert.strictEqual(LogPlayer1ReclaimFunds.args.player, alice, "Should have matched with Player");
            assert.strictEqual(LogPlayer1ReclaimFunds.args.amount.toString(10),gameDeposit.toString(10), "Should have matched with Game deposit send");

        });

        it('should not allow bob to make a move', async() => {
            await expectRevert(
                rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit}),
                "incorrect player"

            );
        });

        it('should then allow alice to withdraw initial funds', async() =>
        {

            const txObj = await rockPaperScissors.withdraw({from: alice})
            const LogWithdraw = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogWithdraw", txObj.logs[0].event);
            assert.strictEqual(LogWithdraw.args.sender, alice, "Should have matched with Player");
            assert.strictEqual(LogWithdraw.args.amount.toString(10),gameDeposit.toString(10), "Should have matched with Game deposit send");

        });

        it('should not allow bob to claim funds after expiration', async() =>
        {

            await time.increase(time.duration.minutes(11));
            await expectRevert(
                rockPaperScissors.player2ClaimFunds(gameId, {from: bob}),
                "player2 has not made a move"
            );
        });
    });


//TEST SET 5

    contract('Before player1 move reveal expiration', (accounts) =>
    {

        const [owner, alice, bob] = accounts;
        const gameDeposit = toWei('4', 'finney');
        const secretAlice = utf8ToHex("AliceSecret&");
        let gameId;
        let rockPaperScissors;

        beforeEach('set up rockPaperScissors and moves', async() =>
        {

            rockPaperScissors = await RockPaperScissors.new({from: owner});
            gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
            await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});
            await rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit});
        });

        it('should not allow bob to claim funds before the expiration', async() =>
        {

            await expectRevert(
                rockPaperScissors.player2ClaimFunds(gameId, {from: bob}),
                "game reveal not yet expired"
            );

        });

        it('should not allow alice to reclaim funds', async() =>
        {
            await expectRevert(
                rockPaperScissors.player1ReclaimFunds(gameId, {from: alice}),
                "player2 has made a move"
            );
        });

        it('should not allow bob to make move', async() =>
        {
            await expectRevert(
                rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit}),
                "player2 has already made a move"
            );
        });


        it('should not allow alice to make commitment to a move', async() =>
        {
            const commitment = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
            await expectRevert(
                rockPaperScissors.player1MoveCommit(commitment, bob, {from: alice, value: gameDeposit}),
                "game id already used"
            );
        });
    });

//TEST Set 6
    contract('After player1 move reveal expires', (accounts) =>
    {

        const [owner, alice, bob] = accounts;
        const gameDeposit = toWei('4', 'finney');
        const secretAlice = utf8ToHex("AliceSecret&");
        let gameId;
        let rockPaperScissors;

        before('set up rockPaperScissors and moves', async () =>
         {

            rockPaperScissors = await RockPaperScissors.new({from: owner});
            gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
            await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});
            await rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit});

        });

        it('should allow bob to claim the funds after reveal expiration period', async() =>
         {

            await time.increase(time.duration.minutes(11));
            const txObj = await rockPaperScissors.player2ClaimFunds(gameId, {from: bob});
            const LogPlayer2ClaimFunds = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogPlayer2ClaimFunds",txObj.logs[0].event);
            assert.strictEqual(LogPlayer2ClaimFunds.args.player, bob);
            assert.strictEqual(LogPlayer2ClaimFunds.args.gameId, gameId, "Should have matched with Game Id send");
            assert.strictEqual(LogPlayer2ClaimFunds.args.amount.toString(10), (gameDeposit*2).toString(10), "Should have matched with Game deposits");

            //Confirm that game has been reset
            const game = await rockPaperScissors.games(gameId);
            assert.equal(game.player2, 0);
            assert.equal(game.gameMove2.toString(10), '0');
            assert.equal(game.deposit, 0);
            assert.equal(game.expiration, 0);

        });

        it('should then allow bob to withdraw the funds', async() =>
        {

            const txObj = await rockPaperScissors.withdraw({from: bob})
            const LogWithdraw = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogWithdraw", txObj.logs[0].event);
            assert.strictEqual(LogWithdraw.args.sender, bob, "Should have matched with Player");
            assert.strictEqual(LogWithdraw.args.amount.toString(10),(gameDeposit * 2).toString(10), "Should have matched with Game deposit send");

        });
    });


// // TEST SET 7
	contract(
	    'RockPaperScissors - Alice commits to a move and bob makes  a different (winning) move',
	    (accounts) =>
     {

        const [owner, alice, bob] = accounts;
	    const {toBN} = web3.utils;
	    const gameDeposit = toWei('4', 'finney');
	    const secretAlice = utf8ToHex("AliceSecret&");
	    let gameId;
	    let rockPaperScissors;

	    beforeEach('set up rockPaperScissors and moves', async () =>
        {
	        rockPaperScissors = await RockPaperScissors.new({from: owner});
	        gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
	        await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});
	        await rockPaperScissors.player2Move(gameId, PAPER, {from: bob, value: gameDeposit});

	    });

	    it('should allow alice to reveal move', async() =>
        {

	        const txObj = await rockPaperScissors.player1Reveal(ROCK, secretAlice, {from: alice});
            const LogMoveReveal = txObj.logs[0];

            assert.strictEqual("LogMoveReveal", LogMoveReveal.event);
            assert.strictEqual(alice, LogMoveReveal.args.player);
            assert.strictEqual(gameId, LogMoveReveal.args.gameId);
            assert.strictEqual(ROCK.toString(10), LogMoveReveal.args.gameMove.toString(10));

            const LogWinner = txObj.logs[1];

            assert.strictEqual("LogWinner", LogWinner.event);
            assert.strictEqual(bob, LogWinner.args.player);
            assert.strictEqual(gameId, LogWinner.args.gameId);

        });


	    it('should allow alice reveal move and bob to claim winnings', async() =>
        {
	        await rockPaperScissors.player1Reveal(ROCK, secretAlice, {from: alice});

	        // bob can withdraw winnings
	        const bobBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(bob));
	        const tx = await rockPaperScissors.withdraw({from: bob});
	        const bobBalanceAfter = toBN(await web3.eth.getBalance(bob));
	        const trans = await web3.eth.getTransaction(tx.tx);
	        const gasPrice = toBN(trans.gasPrice);
	        const gasUsed = toBN(tx.receipt.gasUsed);
	        const gasCost = gasPrice.mul(gasUsed);
	        const amountWon = toBN(2*gameDeposit);

	        assert.isTrue(bobBalanceAfter.eq(bobBalanceBefore.add(amountWon).sub(gasCost)));

            // Confirm that game has been reset
	        const game = await rockPaperScissors.games(gameId);
	        assert.equal(game.player2, 0);
	        assert.equal(game.gameMove2.toString(10), '0');
	        assert.equal(game.deposit, 0);
	        assert.equal(game.expiration, 0);

	    });
	});


    // TEST SET 8
	contract(
    	    'RockPaperScissors - Game where alice has commited to a move and bob has made the same move',
    	    (accounts) =>
    {

        const [owner, alice, bob] = accounts;
	    const gameDeposit = toWei('4', 'finney');
	    const secretAlice = utf8ToHex("AliceSecret&");
	    let gameId;
	    let rockPaperScissors;

	    beforeEach('set up rockPaperScissors and moves', async () =>
        {

	        rockPaperScissors = await RockPaperScissors.new({from: owner});
	        gameId = await rockPaperScissors.generateCommitment(alice, ROCK, secretAlice);
	        await rockPaperScissors.player1MoveCommit(gameId, bob, {from: alice, value: gameDeposit});
	        await rockPaperScissors.player2Move(gameId, ROCK, {from: bob, value: gameDeposit});

	    });

	    it('should allow alice to reveal move', async() =>
        {
	        const txObj = await rockPaperScissors.player1Reveal(ROCK, secretAlice, {from: alice});
            const LogMoveReveal = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 2, "Should have emitted an event");
            assert.strictEqual("LogMoveReveal", LogMoveReveal.event);
            assert.strictEqual(alice, LogMoveReveal.args.player);
            assert.strictEqual(gameId, LogMoveReveal.args.gameId);
            assert.strictEqual(ROCK.toString(10), LogMoveReveal.args.gameMove.toString(10));

            const LogGameDraw = txObj.logs[1];

            assert.strictEqual("LogGameDraw", LogGameDraw.event);
            assert.strictEqual(bob, LogGameDraw.args.player1);
            assert.strictEqual(gameId, LogGameDraw.args.gameId);
            assert.strictEqual(gameDeposit.toString(10),LogGameDraw.args.winnings.toString(10));

	    });


	    it('should not allow alice to reclaim funds', async() =>
        {

            await expectRevert(
	            rockPaperScissors.player1ReclaimFunds(gameId, {from: alice}),
	            "player2 has made a move"
	        );

	    });


	    it('should allow alice reveal move and then both alice and bob to claim winnings', async() =>
        {
	        await rockPaperScissors.player1Reveal(ROCK, secretAlice, {from: alice});


	        // bob can withdraw winnings
	        const txObj = await rockPaperScissors.withdraw({from: bob});
            const LogWithdraw = txObj.logs[0];
            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogWithdraw", txObj.logs[0].event);

            assert.strictEqual(LogWithdraw.args.sender, bob, "Should have matched with Player");
            assert.strictEqual(LogWithdraw.args.amount.toString(10),(gameDeposit).toString(10), "Should have matched with Game deposit send");

	        // alice can withdraw winnings
	       const txObj2 = await rockPaperScissors.withdraw({from: alice});
           const LogWithdraw2 = txObj2.logs[0];
           assert.strictEqual(txObj2.logs.length, 1, "Should have emitted an event");
           assert.strictEqual("LogWithdraw", txObj2.logs[0].event);
           assert.strictEqual(LogWithdraw2.args.sender, alice, "Should have matched with Player");
           assert.strictEqual(LogWithdraw2.args.amount.toString(10),(gameDeposit).toString(10), "Should have matched with Game deposit send");

	        // Confirm that game has been reset
	        const game = await rockPaperScissors.games(gameId);
	        assert.equal(game.player2, 0);
	        assert.equal(game.gameMove2.toString(10), '0');
	        assert.equal(game.deposit, 0);
	        assert.equal(game.expiration, 0);

	        // alice should not be allowed to reclaim funds
	        await expectRevert(
	            rockPaperScissors.player1ReclaimFunds(gameId, {from: alice}),
	            "no funds"
	        );

	        // bob should not be allowed to claim funds
	        await expectRevert(
	            rockPaperScissors.player2ClaimFunds(gameId, {from: bob}),
	            "player2 has not made a move"
	        );

	    });
	});

        //TEST SET 9

	contract(
	    'RockPaperScissors - Given two diffrenet games where alice wins',
	    (accounts) =>
        {

        const [owner, alice, bob, carol] = accounts;
	    const gameDeposit = toWei('4', 'finney');
	    const secretAlice = utf8ToHex("AliceSecret&");
	    const secretAlice2 = utf8ToHex("AliceSecret&2");
	    let gameId1;
	    let gameId2;
	    let rockPaperScissors;

	    before('set up rockPaperScissors and moves', async () =>
        {

            rockPaperScissors = await RockPaperScissors.new({from: owner});
	        gameId1 = await rockPaperScissors.generateCommitment(alice, PAPER, secretAlice);
	        await rockPaperScissors.player1MoveCommit(gameId1, bob, {from: alice, value: gameDeposit});
	        await rockPaperScissors.player2Move(gameId1, ROCK, {from: bob, value: gameDeposit});
	        gameId2 = await rockPaperScissors.generateCommitment(alice, PAPER, secretAlice2);
	        await rockPaperScissors.player1MoveCommit(gameId2, carol, {from: alice, value: gameDeposit});
	        await rockPaperScissors.player2Move(gameId2, ROCK, {from: carol, value: gameDeposit});

	    });

	    it('should allow alice to reveal move and win game1', async() =>
        {
	        const txObj = await rockPaperScissors.player1Reveal(PAPER, secretAlice, {from: alice});
            const LogMoveReveal = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 2, "Should have emitted 2 events");

            assert.strictEqual("LogMoveReveal", LogMoveReveal.event);
            assert.strictEqual(alice, LogMoveReveal.args.player);
            assert.strictEqual(gameId1, LogMoveReveal.args.gameId);
            assert.strictEqual(PAPER.toString(10), LogMoveReveal.args.gameMove.toString(10));

            const LogWinner = txObj.logs[1];

            assert.strictEqual("LogWinner", LogWinner.event);
            assert.strictEqual(alice, LogWinner.args.player);
            assert.strictEqual(gameId1, LogWinner.args.gameId);
            assert.strictEqual((gameDeposit*2).toString(10),LogWinner.args.winnings.toString(10));

	        // Assert that game1 has been reset
	        const game = await rockPaperScissors.games(gameId1);
	        assert.equal(game.player2, 0);
	        assert.equal(game.gameMove2.toString(10), '0');
	        assert.equal(game.deposit, 0);
	        assert.equal(game.expiration, 0);

	    });


	    it('should then allow alice to reveal move and win game2', async() =>
        {
	        const txObj = await rockPaperScissors.player1Reveal(PAPER, secretAlice2, {from: alice});
            const LogMoveReveal = txObj.logs[0];

            assert.strictEqual("LogMoveReveal", LogMoveReveal.event);
            assert.strictEqual(alice, LogMoveReveal.args.player);
            assert.strictEqual(gameId2, LogMoveReveal.args.gameId);
            assert.strictEqual(PAPER.toString(10), LogMoveReveal.args.gameMove.toString(10));

            const LogWinner = txObj.logs[1];

            assert.strictEqual("LogWinner", LogWinner.event);
            assert.strictEqual(alice, LogWinner.args.player);
            assert.strictEqual(gameId2, LogWinner.args.gameId);
            assert.strictEqual((gameDeposit*2).toString(10),LogWinner.args.winnings.toString(10));


	        // Confirm that game2 has been reset
	        const game = await rockPaperScissors.games(gameId2);
	        assert.equal(game.player2, 0);
	        assert.equal(game.gameMove2.toString(10), '0');
	        assert.equal(game.deposit, 0);
	        assert.equal(game.expiration, 0);
	    });


	    it('should then allow alice to withdraw winnings', async() =>
        {

	        const txObj = await rockPaperScissors.withdraw({from: alice});
            const LogWithdraw = txObj.logs[0];

            assert.strictEqual(txObj.logs.length, 1, "Should have emitted an event");
            assert.strictEqual("LogWithdraw", txObj.logs[0].event);
            assert.strictEqual(LogWithdraw.args.sender, alice, "Should have matched with Player");
            assert.strictEqual(LogWithdraw.args.amount.toString(10),(gameDeposit*4).toString(10), "Should have matched with Game deposit send");

	    });

});
