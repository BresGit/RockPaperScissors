pragma solidity ^0.6.0;

import"@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
	 * RockPaperScissors
	 *
	 * Two players play the rock paper and scissors game. The first player1
	 * commits to a move by invoking  functions player1MoveCommit() at the same time the player
	 * sets the amount for to the play.
     * Player2 then can make a move by invoking  player2Move() the deposit must be the same as game deposit.
     * Player1 then reveals the move by  invoking  player1Reveal(). The contract then can determines the result
	 * of the game and re-distributes the game funds (if required).
	 * Players can withdraw their winnings by calling function withdraw().
	 * The winning player can withdraw the amount twice the game deposit.
	 * The losing player cannot withdraw successfully.
     * in  case of a draw each player can withdraw a sum equal to the game deposit.
	 * If player2 fails to make a move in a specified period then player1
	 * may cancel the game and reclaim
	 * If player1 fails to reveal their game move in a specified period then
	 * player2 may claim all of the funds in the game
	 */


contract RockPaperScissors is Pausable, Ownable
{

//Game moves

uint256 Rock = 1;
uint256 Paper = 2;
uint256 Scissors =3;
uint256 None = 0;

struct GameInfo
{

    address player1;
    address player2;
    uint256 gameMove2;
    uint256 deposit;
    uint256 expiration;

}

mapping(bytes32 => GameInfo) public games;
mapping(address => uint256) public balances;

//Wait for a period of 10 mins
uint256 public constant WAITPERIOD = 600;

using SafeMath for uint256;


/* Log that a player won the game */
event LogWinner(address indexed player, bytes32 indexed gameId, uint256 winnings);
/* Log game drawn */
event LogGameDraw(address indexed player0, address indexed player1,  bytes32 indexed gameId, uint256 winnings);
/* Log that a player revealed the move */
event LogMoveReveal(address indexed player, bytes32 indexed gameId, uint256 gameMove);
/* Log that the second player made the move  */
event LogMovePlayer2(address indexed player, bytes32 indexed gameId, uint256 gameMove, uint256 bet);
/* Log that player1 commited to a move  */
/* The gameId is the hash of the commitment */
event LogMoveCommitPlayer1(address indexed player1, address indexed player2, bytes32 indexed gameId, uint256 bet);
/* Log that the second player is opting out of the game because the first player didn't make a move in a specified time period */
event LogPlayer2ClaimFunds(address indexed player, bytes32 indexed gameId, uint256 amount);
/* Log that a player is withdrawing their winnings */
event LogWithdraw(address indexed sender, uint256 amount);
/* Log that the first player is opting out of the game because the secon player didn't make a move in a specified time period */
event LogPlayer1ReclaimFunds(address indexed player, bytes32 indexed gameId, uint256 amount);

constructor () public
{

}

/*
      This function starts the game, the address of the first and second player provided. It then records the
      commitment of the first player, Player1 also sets the game deposit player2 will have to deposit the same amount).
*/

function player1MoveCommit(bytes32 _gameId, address _player2) public payable whenNotPaused returns (bool success)
{

    require(games[_gameId].player1 == address(0), "game id already used");
    require(msg.value !=0, "game deposit required");
    require(_player2 != msg.sender, "player can't play itself");

    games[_gameId].player1 = msg.sender;
    games[_gameId].player2 = _player2;
    games[_gameId].deposit = msg.value;
    games[_gameId].expiration = now.add(WAITPERIOD);
    emit LogMoveCommitPlayer1(msg.sender, _player2, _gameId, msg.value);
    return true;

}

/* This function captures the move of Player2
    This function can be called only after player1MoveCommit executed ???????
 */
function player2Move(bytes32 _gameId, uint256 _gameMove) public payable whenNotPaused returns (bool success)
   {

       require(games[_gameId].player2 == msg.sender, "incorrect player");
       require( msg.value == games[_gameId].deposit, "incorrect deposite to play game");
       require(games[_gameId].gameMove2 == 0, "player2 has already made a move");

       games[_gameId].gameMove2 = _gameMove;
       games[_gameId].expiration = now.add(WAITPERIOD);
       emit LogMovePlayer2(msg.sender, _gameId, _gameMove, msg.value);

       return true;

   }

   /* This function reveals Player1 game move
    */

function player1Reveal(uint256 _gameMove1, bytes32 secret) public whenNotPaused returns (bool success)
  {

      bytes32 _gameId = generateCommitment(msg.sender, _gameMove1, secret);

      require(games[_gameId].player1 == msg.sender, "incorrect player1");

      uint256 gameMove2 = games[_gameId].gameMove2;
      require(gameMove2 != 0, "player2 has not made a move");

      emit LogMoveReveal(msg.sender, _gameId, _gameMove1);

      determineGameResult(_gameId, _gameMove1, gameMove2);

      return true;

  }

  /* This function shows the results of the game, accordingly it distributes the funds */

function determineGameResult(bytes32 _gameId, uint  _gameMove1, uint _gameMove2) internal
    {

        uint256 result = (uint256(_gameMove1).add(2)).sub(uint256(_gameMove2)) % 3;
        uint256 deposit = games[_gameId].deposit;

        if (result == 0) {
            // player1 game winner
            emit LogWinner(msg.sender, _gameId, deposit.mul(2));
            balances[msg.sender] = balances[msg.sender].add(deposit.mul(2));
        } else if (result == 1) {
            // player2 game winner
            address player2 = games[_gameId].player2;
            emit LogWinner(player2, _gameId, deposit.mul(2));
            balances[player2] = balances[player2].add(deposit.mul(2));
        } else if (result == 2) {
            // game is a draw
            address player2 = games[_gameId].player2;
            emit LogGameDraw(msg.sender, player2, _gameId, deposit);
            balances[msg.sender] = balances[msg.sender].add(deposit);
            balances[player2] = balances[player2].add(deposit);
        } else {
            require(false, "unexpected result");
        }

        // reset game
  	        games[_gameId].player2 = address(0);
  	        games[_gameId].gameMove2 = 0;
  	        games[_gameId].deposit = 0;
  	        games[_gameId].expiration = 0;

    }

/* When Player2 doesn't make the move within the required time it allows Player1 to cancel the game and reclaim the funds  */
function player1ReclaimFunds(bytes32 _gameId) public whenNotPaused returns (bool success)
    {

        require(games[_gameId].gameMove2 == 0, "player2 has made a move");

        uint256 deposit = games[_gameId].deposit;
        address player1 = games[_gameId].player1;

        require(deposit != 0, "no funds");
        require(now > games[_gameId].expiration, "game move not expired yet");

        balances[player1] = balances[player1].add(deposit);

        //reset game
        games[_gameId].player2 = address(0);
        games[_gameId].deposit = 0;
        games[_gameId].expiration = 0;

        emit LogPlayer1ReclaimFunds(player1, _gameId, deposit);
        return true;

    }

/* This function lets Player2 to cancel the game and get funds when Player1 did not reveal their move the required time period */
function player2ClaimFunds(bytes32 _gameId) public whenNotPaused returns (bool success)
    {

        require(games[_gameId].gameMove2 != 0, "player2 has not made a move");
        require(now > games[_gameId].expiration,"game reveal not yet expired");

        uint256 deposit = games[_gameId].deposit;
        address player2 = games[_gameId].player2;
        balances[player2] = balances[player2].add(deposit.mul(2));

        //reset game
        games[_gameId].player2 = address(0);
        games[_gameId].gameMove2 = 0;
        games[_gameId].deposit = 0;
        games[_gameId].expiration = 0;

        emit LogPlayer2ClaimFunds(player2, _gameId, deposit.mul(2));
        return true;
    }

/* This function allows a game player to withdraw their funds
 */
function withdraw() public returns (bool success)
    {

        require(balances[msg.sender] > 0, "no funds");

        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;

        emit LogWithdraw(msg.sender, amount);

        (success, ) = msg.sender.call.value(amount)("");
        require(success, "failed to transfer funds");

        return(true);
    }

/* Generating a commitment. address of the player requesting to generate the commitment, game move, secret text that is unique to each player and only known to that player
 */
function generateCommitment(address player, uint256 _gameMove, bytes32 secret) public view returns (bytes32 result)
{

        result = keccak256(abi.encode(address(this), player, _gameMove, secret));

}

function pauseContract() public onlyOwner returns(bool success)
    {

        _pause();
        return true;

    }

function resumeContract() public onlyOwner returns(bool success)
    {

        _unpause();
        return true;

    }
}
