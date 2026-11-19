class_name Player
extends CharacterBody2D
## Jogador — Fase 0: movimento, esquiva com i-frames, ataque melee e à distância.

const PROJECTILE_SCENE := preload("res://scenes/projectiles/energy_bolt.tscn")

@export var move_speed := 170.0
@export var sprint_speed := 250.0
@export var dodge_speed := 430.0
@export var dodge_time := 0.18
@export var dodge_iframes := 0.16
@export var dodge_cost := 18.0
@export var sprint_drain := 8.0
@export var attack_cost := 14.0
@export var melee_damage := 18.0
@export var melee_knockback := 160.0

@onready var _health: HealthComponent = $Health
@onready var _stamina: StaminaComponent = $Stamina
@onready var _hurtbox: Hurtbox = $Hurtbox
@onready var _hitbox: Hitbox = $AimPivot/MeleeHitbox
@onready var _aim: Node2D = $AimPivot
@onready var _visual: Polygon2D = $AimPivot/Visual
@onready var _slash: Polygon2D = $AimPivot/Slash
@onready var _camera: Camera2D = $Camera2D
@onready var _dodge_timer: Timer = $DodgeTimer
@onready var _iframe_timer: Timer = $IframeTimer
@onready var _swing_timer: Timer = $SwingTimer
@onready var _cooldown_timer: Timer = $CooldownTimer

var _is_dodging := false
var _is_attacking := false
var _knockback := Vector2.ZERO
var _dead := false


func _ready() -> void:
	add_to_group("player")
	_health.health_changed.connect(_on_health_changed)
	_health.died.connect(_on_died)
	_stamina.stamina_changed.connect(_on_stamina_changed)
	_hurtbox.hurted.connect(_on_hurted)
	_hitbox.source = self
	_hitbox.damage = melee_damage
	_hitbox.knockback = melee_knockback
	_dodge_timer.timeout.connect(_end_dodge)
	_iframe_timer.timeout.connect(func() -> void: _hurtbox.invulnerable = false)
	_swing_timer.timeout.connect(func() -> void:
		_hitbox.set_active(false)
		_is_attacking = false)
	EventBus.player_health_changed.emit(_health.current_health, _health.max_health)
	EventBus.player_stamina_changed.emit(_stamina.current_stamina, _stamina.max_stamina)


func _physics_process(delta: float) -> void:
	if _dead:
		return

	var input_dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var aim_dir := (get_global_mouse_position() - global_position).normalized()
	if aim_dir != Vector2.ZERO:
		_aim.rotation = aim_dir.angle()

	if Input.is_action_just_pressed("dodge") and not _is_dodging:
		_try_dodge(input_dir, aim_dir)
	if Input.is_action_just_pressed("attack"):
		_try_melee()
	if Input.is_action_just_pressed("attack_ranged"):
		_try_ranged(aim_dir)

	# Movimento
	var target_velocity := Vector2.ZERO
	if _is_dodging:
		target_velocity = _dodge_dir * dodge_speed
	else:
		target_velocity = input_dir * move_speed
		if Input.is_action_pressed("sprint") and input_dir != Vector2.ZERO:
			if _stamina.drain_over_time(sprint_drain, delta):
				target_velocity = input_dir * sprint_speed

	velocity = (velocity - _knockback).move_toward(target_velocity, 1400.0 * delta) + _knockback
	move_and_slide()
	_knockback = _knockback.move_toward(Vector2.ZERO, 900.0 * delta)


var _dodge_dir := Vector2.RIGHT


func _try_dodge(input_dir: Vector2, aim_dir: Vector2) -> void:
	if not _stamina.spend(dodge_cost):
		return
	_dodge_dir = input_dir if input_dir != Vector2.ZERO else aim_dir
	_is_dodging = true
	_hurtbox.invulnerable = true
	_visual.color = Color(0.5, 0.9, 1.0, 0.7)
	_dodge_timer.start(dodge_time)
	_iframe_timer.start(dodge_iframes)


func _end_dodge() -> void:
	_is_dodging = false
	_visual.color = Color.WHITE


func _try_melee() -> void:
	if _is_attacking or _is_dodging or not _stamina.spend(attack_cost):
		return
	_is_attacking = true
	_hitbox.set_active(true)
	_swing_timer.start(0.14)
	_flash_slash()


func _try_ranged(aim_dir: Vector2) -> void:
	if _is_dodging or not _stamina.spend(attack_cost * 0.8):
		return
	var bolt := PROJECTILE_SCENE.instantiate()
	bolt.set_meta("source", self)
	get_tree().current_scene.add_child(bolt)
	bolt.global_position = _aim.global_position + aim_dir * 24.0
	bolt.setup(aim_dir)


func _flash_slash() -> void:
	_slash.visible = true
	_slash.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_property(_slash, "modulate:a", 0.0, 0.14)
	tw.tween_callback(func() -> void: _slash.visible = false)


func _on_hurted(attack: AttackInfo, _hurtbox: Hurtbox) -> void:
	if _dead:
		return
	var dir := Vector2.RIGHT
	if attack.source != null and is_instance_valid(attack.source):
		dir = (global_position - attack.source.global_position).normalized()
	_knockback = dir * attack.knockback * 0.6
	_flash_visual(Color(1.0, 0.35, 0.35))


func _flash_visual(color: Color) -> void:
	_visual.color = color
	var tw := create_tween()
	tw.tween_interval(0.12)
	tw.tween_property(_visual, "color", Color.WHITE, 0.2)


func _on_health_changed(current: float, max_value: float) -> void:
	EventBus.player_health_changed.emit(current, max_value)


func _on_stamina_changed(current: float, max_value: float) -> void:
	EventBus.player_stamina_changed.emit(current, max_value)


func _on_died() -> void:
	_dead = true
	_hitbox.set_active(false)
	EventBus.player_died.emit()
	EventBus.toast_requested.emit("VOCÊ CAIU")
	visible = false
	await get_tree().create_timer(1.6, true).timeout
	get_tree().reload_current_scene()


# --- Save / load -------------------------------------------------------

func get_save_state() -> Dictionary:
	return {"health": _health.current_health, "stamina": _stamina.current_stamina}


func restore_state(state: Dictionary) -> void:
	_dead = false
	visible = true
	_health.current_health = float(state.get("health", _health.max_health))
	_stamina.current_stamina = float(state.get("stamina", _stamina.max_stamina))
	_health.health_changed.emit(_health.current_health, _health.max_health)
	_stamina.stamina_changed.emit(_stamina.current_stamina, _stamina.max_stamina)
