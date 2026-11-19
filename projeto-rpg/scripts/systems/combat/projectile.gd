class_name Projectile
extends Area2D
## Projétil simples do jogador (ataque à distância da Fase 0).

var direction := Vector2.RIGHT
var speed := 420.0
var lifetime := 1.4
var _time_left := 0.0


func setup(p_direction: Vector2, p_speed := 420.0, p_lifetime := 1.4) -> void:
	direction = p_direction.normalized()
	speed = p_speed
	lifetime = p_lifetime
	rotation = direction.angle()


func _physics_process(delta: float) -> void:
	global_position += direction * speed * delta
	_time_left += delta
	if _time_left >= lifetime:
		queue_free()


func _on_area_entered(area: Area2D) -> void:
	var hurtbox := area as Hurtbox
	if hurtbox == null:
		return
	var attack := AttackInfo.create(12.0, source_owner(), 90.0, 6.0, 0.1, 0.05)
	if hurtbox.take_hit(attack):
		EventBus.damage_dealt.emit(attack.damage, hurtbox.global_position, false)
		queue_free()


func source_owner() -> Node:
	return get_meta("source", null)
