extends Node
## EventBus — sinais globais desacoplados (padrão do documento mestre, Seção 18.3).

# Combate
signal player_health_changed(current: float, max_value: float)
signal player_stamina_changed(current: float, max_value: float)
signal player_died
signal enemy_died(enemy: Node)
signal damage_dealt(amount: float, position: Vector2, is_critical: bool)

# Mundo / jogo
signal toast_requested(text: String)
signal save_completed
signal load_completed
