import pyautogui
import random
import time
import keyboard  # pip install keyboard

# ✅ SAFETY
pyautogui.FAILSAFE = True

# 🔥 MAX CHAOS SETTINGS
JITTER = 12
DRIFT = 10
RESISTANCE = 0.6
BURST_CHANCE = 0.12
BURST_FORCE = 80
DELAY = 0.01

print("INSANE mouse running... Press ESC to stop FAST")

prev_x, prev_y = pyautogui.position()
screen_width, screen_height = pyautogui.size()

try:
    while True:
        # 🔴 HARD STOP KEY
        if keyboard.is_pressed("esc"):
            print("Force stopped.")
            break

        x, y = pyautogui.position()

        # detect your movement
        dx = x - prev_x
        dy = y - prev_y

        # opposite resistance
        opp_x = -dx * RESISTANCE
        opp_y = -dy * RESISTANCE

        # heavy jitter
        jitter_x = random.randint(-JITTER, JITTER)
        jitter_y = random.randint(-JITTER, JITTER)

        # strong drift
        drift_x = random.randint(-DRIFT, DRIFT)
        drift_y = random.randint(-DRIFT, DRIFT)

        # 💥 RANDOM BURST
        if random.random() < BURST_CHANCE:
            burst_x = random.randint(-BURST_FORCE, BURST_FORCE)
            burst_y = random.randint(-BURST_FORCE, BURST_FORCE)
        else:
            burst_x = 0
            burst_y = 0

        # combine everything
        new_x = x + opp_x + jitter_x + drift_x + burst_x
        new_y = y + opp_y + jitter_y + drift_y + burst_y

        # ✅ CLAMP to avoid screen edges (prevents crash)
        new_x = max(10, min(screen_width - 10, new_x))
        new_y = max(10, min(screen_height - 10, new_y))

        pyautogui.moveTo(new_x, new_y, duration=0)

        prev_x, prev_y = x, y
        time.sleep(DELAY)

except KeyboardInterrupt:
    print("\nStopped manually.")