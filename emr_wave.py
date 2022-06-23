from matplotlib import pyplot as plt
import numpy as np

def emr_wave():
    plt.figure(dpi=300)
    y_off = np.linspace(0, 1, 10)
    T = np.linspace(0, 20, 1000)
    y_vals = np.zeros((10, 1000))
    for idx, t in enumerate(T):
        y_vals[:, idx] = y_off + np.sin(t)
        
    for idx in range(len(y_off)):
        plt.plot(T, y_vals[idx, :])

    plt.savefig('emr_grid.png')
emr_wave()
