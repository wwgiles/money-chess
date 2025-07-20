package com.example.moneychess

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.moneychess.ui.theme.MoneyChessTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MoneyChessTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MoneyChessGame()
                }
            }
        }
    }
}

enum class PieceType(val symbol: String, val cost: Int) {
    PAWN("♟", 1),
    KNIGHT("♞", 3),
    BISHOP("♝", 3),
    ROOK("♜", 5),
    QUEEN("♛", 9),
    KING("♚", 0) // King is free and mandatory
}

data class ChessPiece(
    val type: PieceType,
    val isWhite: Boolean
)

data class BoardPosition(
    val row: Int,
    val col: Int
)

enum class GamePhase {
    SETUP,
    PLAYING
}

@Composable
fun MoneyChessGame() {
    var gamePhase by remember { mutableStateOf(GamePhase.SETUP) }
    var currentPlayer by remember { mutableStateOf(true) } // true = white, false = black
    var whiteBudget by remember { mutableStateOf(39) }
    var blackBudget by remember { mutableStateOf(39) }
    var board by remember { mutableStateOf(Array(8) { Array<ChessPiece?>(8) { null } }) }
    var selectedPiece by remember { mutableStateOf<PieceType?>(null) }
    var whiteSetupComplete by remember { mutableStateOf(false) }
    var blackSetupComplete by remember { mutableStateOf(false) }
    
    // Gameplay state
    var selectedPosition by remember { mutableStateOf<BoardPosition?>(null) }
    var possibleMoves by remember { mutableStateOf<List<BoardPosition>>(emptyList()) }
    var gameStatus by remember { mutableStateOf("") }
    var moveHistory by remember { mutableStateOf<List<String>>(emptyList()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Game Status
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (currentPlayer) Color(0xFFF5F5F5) else Color(0xFF2C2C2C)
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = when (gamePhase) {
                        GamePhase.SETUP -> "Setup Phase"
                        GamePhase.PLAYING -> "Playing - ${if (currentPlayer) "White" else "Black"}'s Turn"
                    },
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (currentPlayer) Color.Black else Color.White
                )
                
                if (gamePhase == GamePhase.SETUP) {
                    Text(
                        text = "${if (currentPlayer) "White" else "Black"} Player's Turn",
                        fontSize = 16.sp,
                        color = if (currentPlayer) Color.Black else Color.White
                    )
                    Text(
                        text = "Budget: ${if (currentPlayer) whiteBudget else blackBudget} points",
                        fontSize = 14.sp,
                        color = if (currentPlayer) Color.Black else Color.White
                    )
                }
                
                if (gameStatus.isNotEmpty()) {
                    Text(
                        text = gameStatus,
                        fontSize = 14.sp,
                        color = Color.Red,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (gamePhase == GamePhase.SETUP) {
            // Setup UI (existing code)
            Text(
                text = "Select a piece to place:",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.height(120.dp)
            ) {
                items(PieceType.values().filter { it != PieceType.KING }) { piece ->
                    val currentBudget = if (currentPlayer) whiteBudget else blackBudget
                    val canAfford = currentBudget >= piece.cost
                    
                    Card(
                        modifier = Modifier
                            .aspectRatio(1f)
                            .clickable(enabled = canAfford) {
                                selectedPiece = piece
                            },
                        colors = CardDefaults.cardColors(
                            containerColor = when {
                                selectedPiece == piece -> Color(0xFF4CAF50)
                                canAfford -> Color(0xFFE3F2FD)
                                else -> Color(0xFFEEEEEE)
                            }
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = piece.symbol,
                                fontSize = 24.sp,
                                color = if (canAfford) Color.Black else Color.Gray
                            )
                            Text(
                                text = "${piece.cost}pts",
                                fontSize = 10.sp,
                                color = if (canAfford) Color.Black else Color.Gray
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Setup Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(
                    onClick = {
                        if (currentPlayer) {
                            whiteSetupComplete = true
                            if (blackSetupComplete) {
                                gamePhase = GamePhase.PLAYING
                                currentPlayer = true // White starts
                            } else {
                                currentPlayer = false
                            }
                        } else {
                            blackSetupComplete = true
                            if (whiteSetupComplete) {
                                gamePhase = GamePhase.PLAYING
                                currentPlayer = true // White starts
                            } else {
                                currentPlayer = true
                            }
                        }
                    }
                ) {
                    Text("Finish Setup")
                }
                
                Button(
                    onClick = {
                        // Clear current player's pieces
                        val newBoard = board.map { row ->
                            row.map { piece ->
                                if (piece?.isWhite == currentPlayer) null else piece
                            }.toTypedArray()
                        }.toTypedArray()
                        board = newBoard
                        
                        // Reset budget
                        if (currentPlayer) {
                            whiteBudget = 39
                        } else {
                            blackBudget = 39
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF5722))
                ) {
                    Text("Reset")
                }
            }
        } else {
            // Gameplay Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(
                    onClick = {
                        selectedPosition = null
                        possibleMoves = emptyList()
                    }
                ) {
                    Text("Clear Selection")
                }
                
                Button(
                    onClick = {
                        // Reset game
                        gamePhase = GamePhase.SETUP
                        currentPlayer = true
                        whiteBudget = 39
                        blackBudget = 39
                        board = Array(8) { Array<ChessPiece?>(8) { null } }
                        whiteSetupComplete = false
                        blackSetupComplete = false
                        selectedPosition = null
                        possibleMoves = emptyList()
                        gameStatus = ""
                        moveHistory = emptyList()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF5722))
                ) {
                    Text("New Game")
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Chess Board
        Card(
            modifier = Modifier.aspectRatio(1f)
        ) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(8),
                modifier = Modifier.padding(8.dp)
            ) {
                items(64) { index ->
                    val row = index / 8
                    val col = index % 8
                    val isLight = (row + col) % 2 == 0
                    val piece = board[row][col]
                    val position = BoardPosition(row, col)
                    
                    val isSelected = selectedPosition == position
                    val isPossibleMove = possibleMoves.contains(position)
                    val canPlacePiece = gamePhase == GamePhase.SETUP && 
                                       selectedPiece != null && 
                                       piece == null &&
                                       ((currentPlayer && row >= 5) || (!currentPlayer && row <= 2))

                    Box(
                        modifier = Modifier
                            .aspectRatio(1f)
                            .background(
                                when {
                                    isSelected -> Color(0xFF2196F3)
                                    isPossibleMove -> Color(0xFF4CAF50)
                                    canPlacePiece -> Color(0xFF81C784)
                                    isLight -> Color(0xFFF5F5DC)
                                    else -> Color(0xFFD2691E)
                                }
                            )
                            .border(
                                width = if (isSelected || isPossibleMove) 3.dp else 1.dp,
                                color = when {
                                    isSelected -> Color.Blue
                                    isPossibleMove -> Color.Green
                                    else -> Color.Black.copy(alpha = 0.3f)
                                }
                            )
                            .clickable {
                                if (gamePhase == GamePhase.SETUP && canPlacePiece) {
                                    selectedPiece?.let { pieceType ->
                                        val currentBudget = if (currentPlayer) whiteBudget else blackBudget
                                        if (currentBudget >= pieceType.cost) {
                                            board[row][col] = ChessPiece(pieceType, currentPlayer)
                                            if (currentPlayer) {
                                                whiteBudget -= pieceType.cost
                                            } else {
                                                blackBudget -= pieceType.cost
                                            }
                                            selectedPiece = null
                                        }
                                    }
                                } else if (gamePhase == GamePhase.PLAYING) {
                                    if (isPossibleMove) {
                                        // Make the move
                                        selectedPosition?.let { from ->
                                            val movingPiece = board[from.row][from.col]
                                            board[from.row][from.col] = null
                                            board[row][col] = movingPiece
                                            
                                            // Add to move history
                                            val moveNotation = "${('a' + from.col)}${8 - from.row}-${('a' + col)}${8 - row}"
                                            moveHistory = moveHistory + moveNotation
                                            
                                            // Switch turns
                                            currentPlayer = !currentPlayer
                                            selectedPosition = null
                                            possibleMoves = emptyList()
                                            
                                            // Check for game end conditions
                                            checkGameStatus(board, currentPlayer) { status ->
                                                gameStatus = status
                                            }
                                        }
                                    } else if (piece != null && piece.isWhite == currentPlayer) {
                                        // Select piece
                                        selectedPosition = position
                                        possibleMoves = calculatePossibleMoves(board, position, piece)
                                    } else {
                                        // Deselect
                                        selectedPosition = null
                                        possibleMoves = emptyList()
                                    }
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        piece?.let {
                            Text(
                                text = it.type.symbol,
                                fontSize = 24.sp,
                                color = if (it.isWhite) Color.White else Color.Black,
                                textAlign = TextAlign.Center
                            )
                        }
                        
                        // Show possible move indicator
                        if (isPossibleMove && piece == null) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .background(
                                        Color.Green.copy(alpha = 0.7f),
                                        shape = RoundedCornerShape(50)
                                    )
                            )
                        }
                        
                        // Show row/col labels on edges
                        if (col == 0) {
                            Text(
                                text = "${8 - row}",
                                fontSize = 8.sp,
                                modifier = Modifier.align(Alignment.TopStart),
                                color = Color.Black.copy(alpha = 0.5f)
                            )
                        }
                        if (row == 7) {
                            Text(
                                text = "${'a' + col}",
                                fontSize = 8.sp,
                                modifier = Modifier.align(Alignment.BottomEnd),
                                color = Color.Black.copy(alpha = 0.5f)
                            )
                        }
                    }
                }
            }
        }

        if (gamePhase == GamePhase.SETUP) {
            Spacer(modifier = Modifier.height(16.dp))
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))
            ) {
                Column(
                    modifier = Modifier.padding(12.dp)
                ) {
                    Text(
                        text = "Setup Rules:",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "• Place pieces in your first 3 rows only",
                        fontSize = 12.sp
                    )
                    Text(
                        text = "• You have 39 points to spend",
                        fontSize = 12.sp
                    )
                    Text(
                        text = "• King is free but must be placed",
                        fontSize = 12.sp
                    )
                    Text(
                        text = "• Tap 'Finish Setup' when done",
                        fontSize = 12.sp
                    )
                }
            }
        } else {
            // Move History
            if (moveHistory.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF3E5F5))
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Text(
                            text = "Move History:",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = moveHistory.takeLast(5).joinToString(" • "),
                            fontSize = 12.sp,
                            maxLines = 2
                        )
                    }
                }
            }
        }
    }
}

// Helper functions for chess logic
fun calculatePossibleMoves(
    board: Array<Array<ChessPiece?>>,
    position: BoardPosition,
    piece: ChessPiece
): List<BoardPosition> {
    val moves = mutableListOf<BoardPosition>()
    val row = position.row
    val col = position.col
    
    when (piece.type) {
        PieceType.PAWN -> {
            val direction = if (piece.isWhite) -1 else 1
            val startRow = if (piece.isWhite) 6 else 1
            
            // Forward move
            if (row + direction in 0..7 && board[row + direction][col] == null) {
                moves.add(BoardPosition(row + direction, col))
                
                // Double move from start
                if (row == startRow && board[row + 2 * direction][col] == null) {
                    moves.add(BoardPosition(row + 2 * direction, col))
                }
            }
            
            // Diagonal captures
            for (dc in listOf(-1, 1)) {
                val newRow = row + direction
                val newCol = col + dc
                if (newRow in 0..7 && newCol in 0..7) {
                    val targetPiece = board[newRow][newCol]
                    if (targetPiece != null && targetPiece.isWhite != piece.isWhite) {
                        moves.add(BoardPosition(newRow, newCol))
                    }
                }
            }
        }
        
        PieceType.ROOK -> {
            // Horizontal and vertical moves
            val directions = listOf(Pair(0, 1), Pair(0, -1), Pair(1, 0), Pair(-1, 0))
            for ((dr, dc) in directions) {
                for (i in 1..7) {
                    val newRow = row + dr * i
                    val newCol = col + dc * i
                    if (newRow !in 0..7 || newCol !in 0..7) break
                    
                    val targetPiece = board[newRow][newCol]
                    if (targetPiece == null) {
                        moves.add(BoardPosition(newRow, newCol))
                    } else {
                        if (targetPiece.isWhite != piece.isWhite) {
                            moves.add(BoardPosition(newRow, newCol))
                        }
                        break
                    }
                }
            }
        }
        
        PieceType.BISHOP -> {
            // Diagonal moves
            val directions = listOf(Pair(1, 1), Pair(1, -1), Pair(-1, 1), Pair(-1, -1))
            for ((dr, dc) in directions) {
                for (i in 1..7) {
                    val newRow = row + dr * i
                    val newCol = col + dc * i
                    if (newRow !in 0..7 || newCol !in 0..7) break
                    
                    val targetPiece = board[newRow][newCol]
                    if (targetPiece == null) {
                        moves.add(BoardPosition(newRow, newCol))
                    } else {
                        if (targetPiece.isWhite != piece.isWhite) {
                            moves.add(BoardPosition(newRow, newCol))
                        }
                        break
                    }
                }
            }
        }
        
        PieceType.KNIGHT -> {
            val knightMoves = listOf(
                Pair(-2, -1), Pair(-2, 1), Pair(-1, -2), Pair(-1, 2),
                Pair(1, -2), Pair(1, 2), Pair(2, -1), Pair(2, 1)
            )
            for ((dr, dc) in knightMoves) {
                val newRow = row + dr
                val newCol = col + dc
                if (newRow in 0..7 && newCol in 0..7) {
                    val targetPiece = board[newRow][newCol]
                    if (targetPiece == null || targetPiece.isWhite != piece.isWhite) {
                        moves.add(BoardPosition(newRow, newCol))
                    }
                }
            }
        }
        
        PieceType.QUEEN -> {
            // Combination of rook and bishop moves
            val directions = listOf(
                Pair(0, 1), Pair(0, -1), Pair(1, 0), Pair(-1, 0),
                Pair(1, 1), Pair(1, -1), Pair(-1, 1), Pair(-1, -1)
            )
            for ((dr, dc) in directions) {
                for (i in 1..7) {
                    val newRow = row + dr * i
                    val newCol = col + dc * i
                    if (newRow !in 0..7 || newCol !in 0..7) break
                    
                    val targetPiece = board[newRow][newCol]
                    if (targetPiece == null) {
                        moves.add(BoardPosition(newRow, newCol))
                    } else {
                        if (targetPiece.isWhite != piece.isWhite) {
                            moves.add(BoardPosition(newRow, newCol))
                        }
                        break
                    }
                }
            }
        }
        
        PieceType.KING -> {
            val kingMoves = listOf(
                Pair(-1, -1), Pair(-1, 0), Pair(-1, 1),
                Pair(0, -1), Pair(0, 1),
                Pair(1, -1), Pair(1, 0), Pair(1, 1)
            )
            for ((dr, dc) in kingMoves) {
                val newRow = row + dr
                val newCol = col + dc
                if (newRow in 0..7 && newCol in 0..7) {
                    val targetPiece = board[newRow][newCol]
                    if (targetPiece == null || targetPiece.isWhite != piece.isWhite) {
                        moves.add(BoardPosition(newRow, newCol))
                    }
                }
            }
        }
    }
    
    return moves
}

fun checkGameStatus(
    board: Array<Array<ChessPiece?>>,
    currentPlayer: Boolean,
    onStatusChange: (String) -> Unit
) {
    // Find kings
    var whiteKing: BoardPosition? = null
    var blackKing: BoardPosition? = null
    
    for (row in 0..7) {
        for (col in 0..7) {
            val piece = board[row][col]
            if (piece?.type == PieceType.KING) {
                if (piece.isWhite) {
                    whiteKing = BoardPosition(row, col)
                } else {
                    blackKing = BoardPosition(row, col)
                }
            }
        }
    }
    
    // Check if current player's king is missing (captured)
    if (currentPlayer && whiteKing == null) {
        onStatusChange("Black wins! White king captured.")
    } else if (!currentPlayer && blackKing == null) {
        onStatusChange("White wins! Black king captured.")
    } else {
        onStatusChange("")
    }
}
