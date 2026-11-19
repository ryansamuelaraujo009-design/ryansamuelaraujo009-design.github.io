class_name EnemyGrunt
extends CharacterBody2D
## Inimigo básico da Fase 0: persegue, telegrafia (windup), ataque, stagger e morte.

enum State { IDLE, CHASE, WINDUP, ATTACK, RECOVER, STAGGER, DEAD }

@export var move_speed := 95.0
@export var detection_range := 260.0
@export var attack_range := 44.0
@export var attack_damage := 12.0
@export var windup_time := 0.55
@export var poise_max := 30.0

@onready var _health: HealthComponent = $Health
@onready var _hurtbox: Hurtbox = $Hurtbox
@onready var _hitbox: Hitbox = $AimPivot/AttackHitbox
@onready var _aim: Node2D = $AimPivot
@onready var _visual: Polygon2D = $AimPivot/Visual
@onready var _windup_timer: Timer = $WindupTimer
@onready var _attack_timer: Timer = $AttackTimer
@onready var _recover_timer: Timer = $RecoverTimer
@onready var _stagger_timer: Timer = $StaggerTimer

var state: State = State.IDLE
var _player: Player
var _poise := 0.0
var _knockback := Vector2.ZERO


func _ready() -> void:
	add_to_group("enemies")
	_poise = poise_max
	_hitbox.source = self
	_hitbox.damage = attack_damage
	_hurtbox.hurted.connect(_on_hurted)
	_health.died.connect(_die)
	_windup_timer.timeout.connect(_finish_windup)
	_attack_timer.timeout.connect(_finish_attack)
	_recover_timer.timeout.connect(func() -> void: state = State.CHASE)
	_stagger_timer.timeout.connect(_finish_stagger)
	_player = get_tree().get_first_node_in_group("player") as Player


func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return
	_knockback = _knockback.move_toward(Vector2.ZERO, 800.0 * delta)

	match state:
	_State.IDLE, State.CHASE:
			_chase(delta)
		_:
			velocity = _knockback
			move_and_slide()


func _chase(_delta: float) -> void:
	if _player == null or _player._dead:
		_player = get_tree().get_first_node_in_group("player") as Player
	if _player == null:
		state = State.IDLE
		velocity = Vector2.ZERO
		return

	var to_player := _player.global_position - global_position
	var distance := to_player.length()

	if distance > detection_range:
		state = State.IDLE
		velocity = Vector2.ZERO
		return

	state = State.CHASE
	velocity = to_player.normalized() * move_speed + _knockback
	move_and_slide()

	if distance <= attack_range:
		_start_windup()


func _start_windup() -> void:
	state = State.WINDUP
	velocity = Vector2.ZERO
	_aim.look_at(_player.global_position)
	# Telegrafia: destaque amarelo (cor de aviso, Seção 13.2)
	_visual.color = Color(1.0, 0.85, 0.3)
	_windup_timer.start(windup_time)


func _finish_windup() -> void:
	state = State.ATTACK
	_visual.color = Color(1.0, 0.4, 0.3)
	_hitbox.set_active(true)
	_attack_timer.start(0.16)


func _finish_attack() -> void:
	_hitbox.set_active(false)
	state = State.RECOVER
	_visual.color = Color.WHITE
	_recover_timer.start(0.6)


func _on_hurted(attack: AttackInfo, _hurtbox: Hurtbox) -> void:
	if state == State.DEAD:
		return
	var dir := Vector2.RIGHT
	if attack.source != null and is_instance_valid(attack.source):
		dir = (global_position - attack.source.global_position).normalized()
	_knockback = dir * attack.knockback
	_poise -= attack.poise_damage
	_flash_visual(Color.WHITE)
	if _poise <= 0.0 and state != State.STAGGER:
		_start_stagger()


func _start_stagger() -> void:
	state = State.STAGGER
	_poise = poise_max
	_hitbox.set_active(false)
	_windup_timer.stop()
	_attack_timer.stop()
	_visual.color = Color(0.6, 0.6, 1.0)
	_stagger_timer.start(0.7)


func _finish_stagger() -> void:
	state = State.CHASE
	_visual.color = Color.WHITE


func _flash_visual(color: Color) -> void:
	_visual.color = color
	var tw := create_tween()
	tw.tween_interval(0.1)
	tw.tween_property(_visual, "color", Color.WHITE, 0.2)


func _die() -> void:
	state = State.DEAD
	_hitbox.set_active(false)
	set_physics_process(false)
	_visual.color = Color(0.4, 0.4, 0.4)
	EventBus.enemy_died.emit(self)
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.6)
	tw.tween_callback(queue_free)
