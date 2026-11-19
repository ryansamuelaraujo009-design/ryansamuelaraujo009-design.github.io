class_name Hitbox
extends Area2D
## Área que aplica golpes. Ativada só durante a janela do ataque.

@export var damage := 10.0
@export var knockback := 120.0
@export var poise_damage := 8.0
@export var hitstun := 0.15
@export var hitstop := 0.08

var active := false
var source: Node
var _already_hit: Dictionary = {}


func _ready() -> void:
	area_entered.connect(_on_area_entered)
	monitoring = false


func set_active(value: bool) -> void:
	active = value
	set_deferred("monitoring", value)
	if not value:
		_already_hit.clear()


func _on_area_entered(area: Area2D) -> void:
	if not active:
		return
	var hurtbox := area as Hurtbox
	if hurtbox == null or _already_hit.has(hurtbox):
		return
	_already_hit[hurtbox] = true

	var attack := AttackInfo.create(damage, source, knockback, poise_damage, hitstun, hitstop)
	if hurtbox.take_hit(attack):
		EventBus.damage_dealt.emit(attack.damage, hurtbox.global_position, attack.is_critical)
		if attack.hitstop > 0.0:
			Engine.time_scale = 0.05
			get_tree().create_timer(attack.hitstop, true, false, true).timeout.connect(
					func() -> void: Engine.time_scale = 1.0)
