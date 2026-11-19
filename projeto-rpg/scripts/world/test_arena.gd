extends Node2D
## Arena de teste da Fase 0 — prova de vida (movimento, combate, save).


func _ready() -> void:
	SaveManager.consume_pending_on_ready()
	GameManager.current_region_id = "test_arena"
