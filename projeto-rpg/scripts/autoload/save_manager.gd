extends Node
## SaveManager — save/load versionado em JSON (Seção 18.5 do documento mestre).

const SAVE_PATH := "user://save_slot_0.json"
const SAVE_VERSION := 1

var pending_load: Dictionary = {}


func save_game() -> void:
	var player := get_tree().get_first_node_in_group("player") as Node2D
	if player == null:
		return

	var data := {
		"version": SAVE_VERSION,
		"scene": get_tree().current_scene.scene_file_path,
		"region": GameManager.current_region_id,
		"player": {
			"position": [player.global_position.x, player.global_position.y],
			"health": player.get("current_health") if player.has_method("get_save_state") else 100.0,
		},
		"timestamp": Time.get_unix_time_from_system(),
	}

	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		EventBus.toast_requested.emit("ERRO AO SALVAR")
		return
	file.store_string(JSON.stringify(data, "\t"))
	EventBus.save_completed.emit()
	EventBus.toast_requested.emit("JOGO SALVO (F5)")


func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		EventBus.toast_requested.emit("NENHUM SAVE ENCONTRADO")
		return

	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		EventBus.toast_requested.emit("SAVE CORROMPIDO")
		return

	var data: Dictionary = parsed
	var scene_path: String = data.get("scene", "")
	if scene_path.is_empty():
		return

	if get_tree().current_scene.scene_file_path == scene_path:
		_apply_pending(data)
	else:
		pending_load = data
		get_tree().change_scene_to_file(scene_path)


func consume_pending_on_ready() -> void:
	## Chamado pela cena em _ready() após um change_scene.
	if not pending_load.is_empty():
		_apply_pending(pending_load)
		pending_load = {}


func _apply_pending(data: Dictionary) -> void:
	var player := get_tree().get_first_node_in_group("player") as Node2D
	if player == null:
		return
	var pos: Array = data.get("player", {}).get("position", [0.0, 0.0])
	player.global_position = Vector2(pos[0], pos[1])
	if player.has_method("restore_state"):
		player.restore_state(data.get("player", {}))
	EventBus.load_completed.emit()
	EventBus.toast_requested.emit("JOGO CARREGADO (F6)")
