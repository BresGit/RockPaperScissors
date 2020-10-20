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

// The allowed game moves
enum GameMoves {
    NoMove,
    Rock,
    Paper,
    Scissors
}


struct GameInfo
{

//    address player1;
    address player2;
    GameMoves gameMove2;
    uint256 deposit;
    uint256 expiration;

}


/* here the commitment is mapped to a game via 'game id'
which represents a commitment made by player1*/
mapping(bytes32 => GameInfo) public games;

mapping(address => uint256) public balances;

//Wait for a period of 10 mins
uint256 public constant WAITPERIOD = 600;

using SafeMath for uint256;

/* Checking for valid game moves */

modifier moveIsValid(GameMoves _move)
{
   require(GameMoves.Rock <= _move && _move <= GameMoves.Scissors, "invalid move");
   _;

}


/* Log that a player won the game */
event LogWinner(address indexed winner, bytes32 indexed gameId, uint256 winnings);
/* Log game drawn */
event LogGameDraw(bytes32 indexed gameId, address indexed player1, address indexed player2, uint256 winnings);
/* Log that a player revealed the move */
event LogMoveReveal(address indexed player, bytes32 indexed gameId, GameMoves gameMove);
/* Log that the second player made the move  */
event LogMovePlayer2(address indexed player, bytes32 indexed gameId, GameMoves gameMove, uint256 bet);
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
      This function starts the game, the address of the first and second player provided.
      It also records the game move of player1 as a commitment (hash of the game move).
      Player1 also sets the game deposit player2 will have to deposit the same amount.
*/

function player1MoveCommit(bytes32 _gameId, address _player2) public payable whenNotPaused returns (bool success)
{

    require(games[_gameId].player2 == address(0), "game id already used");
    require(msg.value !=0, "game deposit required");
    require(_player2 != msg.sender, "player can't play itself");

    //games[_gameId].player1 = msg.sender;
    games[_gameId].player2 = _player2;
    games[_gameId].deposit = msg.value;
    games[_gameId].expiration = now.add(WAITPERIOD);
    emit LogMoveCommitPlayer1(msg.sender, _player2, _gameId, msg.value);
    return true;

}

/* This function captures the move of Player2
    This function can be called only after player1MoveCommit executed ???????
 */
function player2Move(bytes32 _gameId, GameMoves _gameMove) public payable whenNotPaused  moveIsValid(_gameMove) returns (bool success)
   {

       require(games[_gameId].player2 == msg.sender, "incorrect player");
       require( msg.value == games[_gameId].deposit, "incorrect deposite to play game");
       require(games[_gameId].gameMove2 == GameMoves.NoMove, "player2 has already made a move");

       games[_gameId].gameMove2 = _gameMove;
       games[_gameId].expiration = now.add(WAITPERIOD);
       emit LogMovePlayer2(msg.sender, _gameId, _gameMove, msg.value);

       return true;

   }

   /* This function reveals Player1 game move
    */

function player1Reveal(GameMoves _gameMove1, bytes32 secret) public whenNotPaused  moveIsValid(_gameMove1) returns (bool success)
  {

      bytes32 _gameId = generateCommitment(msg.sender, _gameMove1, secret);

      //require(games[_gameId].player1 == msg.sender, "incorrect player1");

      GameMoves gameMove2 = games[_gameId].gameMove2;
      require(gameMove2 != GameMoves.NoMove, "player2 has not made a move");

      emit LogMoveReveal(msg.sender, _gameId, _gameMove1);

      determineGameResult(_gameId, _gameMove1, gameMove2);

      return true;

  }

  /* This function shows the results of the game, accordingly it distributes the funds */

function determineGameResult(bytes32 _gameId, GameMoves  _gameMove1, GameMoves _gameMove2) internal
        moveIsValid(_gameMove1)	moveIsValid(_gameMove2)
    {

        uint256 result = (uint256(_gameMove1).add(2)).sub(uint256(_gameMove2)) % 3;
        uint256 deposit = games[_gameId].deposit;

        if (result == 0) {
            // player1 game winner
            balances[msg.sender] = balances[msg.sender].add(deposit.mul(2));
            emit LogWinner(msg.sender, _gameId, deposit.mul(2));
        } else if (result == 1) {
            // player2 game winner
            address player2 = games[_gameId].player2;
            balances[player2] = balances[player2].add(deposit.mul(2));
            emit LogWinner(player2, _gameId, deposit.mul(2));
        } else if (result == 2) {
            // game is a draw
            address player2 = games[_gameId].player2;
            balances[msg.sender] = balances[msg.sender].add(deposit);
            balances[player2] = balances[player2].add(deposit);
            emit LogGameDraw(_gameId, msg.sender, player2, deposit);
        } else {
            require(false, "unexpected result");
        }

        // reset game
  	        games[_gameId].player2 = address(0);
  	        games[_gameId].gameMove2 = GameMoves(0);
  	        games[_gameId].deposit = 0;
  	        games[_gameId].expiration = 0;

    }

/* When Player2 doesn't make the move within the required time it allows Player1 to cancel the game and reclaim the funds  */
function player1ReclaimFunds(GameMoves _gameMove1, bytes32 _secret) public whenNotPaused returns (bool success)
    {

        //address player1 = games[_gameId].player1;
        //require(player1 == msg.sender);
        bytes32 _gameId = generateCommitment(msg.sender, _gameMove1, _secret);

        require(games[_gameId].gameMove2 == GameMoves.NoMove, "player2 has made a move");

        require(now > games[_gameId].expiration, "game move not expired yet");

        uint256 deposit = games[_gameId].deposit;
        require(deposit != 0, "no funds");

        balances[msg.sender] = balances[msg.sender].add(deposit);

        //reset game
        games[_gameId].player2 = address(0);
        games[_gameId].deposit = 0;
        games[_gameId].expiration = 0;

        emit LogPlayer1ReclaimFunds(msg.sender, _gameId, deposit);
        return true;

    }

/* This function lets Player2 to cancel the game and get funds when Player1 did not reveal their move the required time period */
function player2ClaimFunds(bytes32 _gameId) public whenNotPaused returns (bool success)
    {

        address player2 = games[_gameId].player2;

        require(games[_gameId].gameMove2 != GameMoves.NoMove, "player2 has not made a move");
        require(player2 == msg.sender,"only player2 can claim funds");

        require(now > games[_gameId].expiration,"game reveal not yet expired");

        uint256 deposit = games[_gameId].deposit;

        balances[player2] = balances[player2].add(deposit.mul(2));

        //reset game
        games[_gameId].player2 = address(0);
        games[_gameId].gameMove2 = GameMoves(0);
        games[_gameId].deposit = 0;
        games[_gameId].expiration = 0;

        emit LogPlayer2ClaimFunds(player2, _gameId, deposit.mul(2));
        return true;
    }

/* This function allows a game player to withdraw their funds
 */
function withdraw() public returns (bool success)
    {

        uint256 amount = balances[msg.sender];
        require(amount > 0, "no funds");

        balances[msg.sender] = 0;

        emit LogWithdraw(msg.sender, amount);

        (success, ) = msg.sender.call.value(amount)("");
        require(success, "failed to transfer funds");

        return(true);
    }

/* Generating a commitment. address of the player requesting to generate the commitment, game move, secret text that is unique to each player and only known to that player
 */
function generateCommitment(address player, GameMoves _gameMove, bytes32 secret) public view  moveIsValid(_gameMove) returns (bytes32 result)
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
