extends Node
## GameManager — estado global da partida e pausa.

var is_paused := false
var current_region_id := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		toggle_pause()
	elif event.is_action_pressed("quick_save"):
		SaveManager.save_game()
	elif event.is_action_pressed("quick_load"):
		SaveManager.load_game()


func toggle_pause() -> void:
	is_paused = not is_paused
	get_tree().paused = is_paused
	EventBus.toast_requested.emit("PAUSADO" if is_paused else "RETOMADO")
