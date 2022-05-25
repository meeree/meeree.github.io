import numpy as np
from matplotlib import pyplot as plt
from scipy import ndimage
from progressbar import ProgressBar

def eval(N):
    gna = 50.0
    gk = 35.0
    gl = 0.3 

    Ena = 55.0 
    Ek = -77.0 
    El = -65.0 
    dt = 0.1
    T = int(10**4)

    def simulate(stddev, Iapp):
        V = np.zeros(N) #np.random.normal(0.0, 10.0, size=N)
        m = np.zeros(N)
        n = np.zeros(N) #np.random.normal(0.3, 0.02, size=N)
        h = np.ones(N)
        def trapezoid(dt, V, m, n, h):
            v1 = 25
            c = 9.0

            aN = 0.02 * (V - v1) / (1 - np.exp((-V + v1) / c))
            aM = 0.182 * (V + 35) / (1 - np.exp((-V - 35) / c))
            aH = 0.25 * np.exp((-V - 90.0) / 12.0)

            bN = -0.002 * (V - v1) / (1 - np.exp((V - v1) / c))
    #        bN = 0.125 * np.exp((-V + 70) / 19.7)
            bM = -0.124 * (V + 35) / (1 - np.exp((V + 35) / c))
            bH = 0.25 * np.exp((V + 35) / 12.0)

            nan_inds = np.logical_or(V == v1, V == -35)
            aN[nan_inds] = 0.18
            bN[nan_inds] = 0.08
            aM[nan_inds] = 1.638
            bM[nan_inds] = 1.16

            m = (aM * dt + (1 - dt / 2 * (aM + bM)) * m) / (dt / 2 * (aM + bM) + 1)
            n = (aN * dt + (1 - dt / 2 * (aN + bN)) * n) / (dt / 2 * (aN + bN) + 1)
            h = (aH * dt + (1 - dt / 2 * (aH + bH)) * h) / (dt / 2 * (aH + bH) + 1)

            rnd = np.random.normal(0.0, stddev, size = N)
            G = gna * m**3 * h + gk * n**4 + gl
            E = gna * m**3 * h * Ena + gk * n**4 * Ek + gl * El
            V = (V * (1 - dt /2 * G) + dt * (E + Iapp + rnd)) / (1 + dt / 2 * G) 
            return V, m, n, h

        def to_record(V, m, n, h, record, i):
            record[0, i, :] = V
            record[1, i, :] = m
            record[2, i, :] = n
            record[3, i, :] = h

        record = np.zeros((4, T+1, N))
        to_record(V, m, n, h, record, 0)
        for i in range(T):
            V, m, n, h = trapezoid(dt, V, m, n, h)
            to_record(V, m, n, h, record, i+1)
        return record

    Iapp = np.linspace(0.0, 3.0, N)
    record = simulate(0.0, Iapp)
    transient = int(T * 0.2)

    thresh = -40
    firing = np.logical_and(record[0, 1:, :] > thresh, record[0, :-1, :] <= thresh)
    firing_rate = np.mean(firing[transient:], axis=0) * T 

    # Plot specific record trace.
    idx = N // 2
    trace = record[:, :, idx]
    plt.figure(dpi=300, figsize=(5,2))
    plt.plot(trace[0, :], linewidth = 0.7)
    plt.xticks(np.linspace(0, T, 5), np.linspace(0, T, 5) * dt / 1000)
    plt.ylabel('Voltage (mV)')

    plt.axvspan(0, transient, color='red', alpha=0.3)
    mn = np.min(trace[0, :]) 
    mx = np.max(trace[0, :])
    plt.text(T * 0.05, mn - (mx - mn) * 0.2, 'Transient', fontsize=7, color='red')

    plt.title(f'dt = {dt}, Iapp = {Iapp[idx]:.2f}: Firing Rate = {firing_rate[idx]:.2f} Hz')
    plt.savefig('hh_playground_1.png')

    plt.figure(dpi=300)
    plt.plot(Iapp, firing_rate) 
    plt.title('F-I Curve')
    plt.ylabel('Firing Rate (Hz)')
    plt.xlabel('Applied Current')
    plt.savefig('f_i_curve.png')

    return record, firing_rate

eval(1000)
