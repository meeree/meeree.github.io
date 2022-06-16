from matplotlib import pyplot as plt
import numpy as np
from matplotlib.animation import FuncAnimation

def planet_sim(x, y, m, v_x, v_y, end = 1, dt = 0.01):
    M = np.outer(m, m)
    G = 1.0
    def compute_forces(x, y):
        D_x = x.reshape((-1, 1)) - x.reshape((1, -1))
        D_y = y.reshape((-1, 1)) - y.reshape((1, -1))
        R_2 = D_x**2 + D_y**2 
        F = G * M / R_2
        np.nan_to_num(F, copy=False)
        f_x = np.sum(F * D_x, 0)
        f_y = np.sum(F * D_y, 0)
        return f_x, f_y

    T = np.arange(0, end + dt, dt)
    p = np.zeros((len(T), len(x), 2))
    p[0, :, 0] = x; p[0, :, 1] = y
    for idx, t in enumerate(T[1:], 1):
        f_x, f_y = compute_forces(x, y)
        a_x, a_y = f_x / m, f_y / m
        v_x, v_y = v_x + dt * a_x, v_y + dt * a_y
        x, y = x + dt * v_x, y + dt * v_y
        p[idx, :, 0] = x
        p[idx, :, 1] = y
    return p

def plot_trajectories(p, m, postfix=''):
    plt.figure(dpi=400)
    for idx in range(p.shape[1]):
        plt.plot(p[:, idx, 0], p[:, idx, 1], label=f'{idx}')
        plt.scatter(p[0, idx, 0], p[0, idx, 1], color='green', s=m[idx])
        plt.scatter(p[-1, idx, 0], p[-1, idx, 1], color='red', s=m[idx])
    mn, mx = np.min(p, (0,1)), np.max(p, (0,1))
    mn -= (mx - mn) * 0.1
    mx += (mx - mn) * 0.1
    plt.xlim(mn[0], mx[0])
    plt.ylim(mn[1], mx[1])
    plt.savefig(f'Planets{postfix}.png')

def anim_trajectories(p, m, postfix=''):
    fig = plt.figure(dpi=150)
    lines = [None for i in range(p.shape[1])]
    dots = list(lines)
    for idx in range(p.shape[1]):
        lines[idx], = plt.plot([], [])
        dots[idx] = plt.scatter([], [], s=m[idx])
        plt.plot(p[:, idx, 0], p[:, idx, 1], alpha = 0.1, color='black', linestyle='--')

    def update(frame):
        print(frame)
        data = p[:frame+1, :, :]
        for idx in range(p.shape[1]):
            lines[idx].set_data(data[:, idx, 0], data[:, idx, 1])
            dots[idx].set_offsets(data[-1, :])
        mn, mx = np.min(data, (0,1)), np.max(data, (0,1))
        mn -= (mx - mn) * 0.1
        mx += (mx - mn) * 0.1
        plt.xlim(mn[0], mx[0])
        plt.ylim(mn[1], mx[1])
        return lines + dots

    anim = FuncAnimation(fig, update, frames=list(range(0, p.shape[0], 20)), blit=True)
    anim.save(f'Planets{postfix}.mp4', writer='ffmpeg', fps=20)


def case_1():
    x = np.zeros(2)
    y = np.zeros(2)
    y[1] = -0.5
    x[1] = -0.5
    v_x, v_y = np.zeros_like(x), np.zeros_like(y)
    m = np.ones_like(x)
    m[0] = 10.0
    v_x[1] = 2.0
    v_y[1] = 0.0
    p = planet_sim(x, y, m, v_x, v_y, 200, 0.03)
    anim_trajectories(p, m, '')

def circular_planets(N, rad, vel, mass=1.0):
    m = np.ones(N) * mass
    x, y = np.zeros(N), np.zeros(N)
    v_x, v_y = np.zeros(N), np.zeros(N)
    for i in range(N):
        t = 2 * np.pi * (i / float(N))
        x[i], y[i] = rad * np.cos(t), rad * np.sin(t)
        v_x[i], v_y[i] = -vel * np.sin(t), vel * np.cos(t)
    return x, y, m, v_x, v_y

def case_2():
    x, y, m, v_x, v_y = circular_planets(5, 1., 1.)
    p = planet_sim(x, y, m, v_x, v_y, 50)
    anim_trajectories(p, m, '_trochoid')

def case_3():
    x, y, m, v_x, v_y = circular_planets(5, 1., 1., mass=0.1)
    x2, y2, m2, v_x2, v_y2 = circular_planets(5, 1., -1.)

    x = np.concatenate([x, x2])
    y = np.concatenate([y, y2])
    m = np.concatenate([m, m2])
    v_x = np.concatenate([v_x, v_x2])
    v_y = np.concatenate([v_y, v_y2])

    p = planet_sim(x, y, m, v_x, v_y, 30, dt=0.001)
    plot_trajectories(p, m, '_hypotrochoid2')

def case_4():
    x = np.zeros(2)
    y = np.zeros(2)
    x[1] = -0.5
    v_x, v_y = np.zeros_like(x), np.zeros_like(y)
    m = np.ones_like(x)
    m[0] = 100.0
    m[1] = 0.001
    v_y[1] = 8.0
    p = planet_sim(x, y, m, v_x, v_y, 30, 0.01)
    plot_trajectories(p, m)
case_4()
