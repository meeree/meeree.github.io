import numpy as np
from matplotlib import pyplot as plt
from scipy import stats
from progressbar import ProgressBar

# Simulate a grid of initial conditions from -5 to 5.
mu = 1.0
T = np.linspace(0, 10, 1000)
dt = T[1] - T[0]
def grid():
    def dXdt(X, mu):
        return np.array([X[1], 
                mu * (1 - X[0]**2) * X[1] - X[0]])

    init = np.linspace(-5, 5, 20)
    X = np.zeros((2, len(init), len(init), len(T)))
    for i in range(len(init)):
        for j in range(len(init)):
            X[:, i, j, 0] = np.array([init[i], init[j]])
            for idx, t in enumerate(T[1:]):
                X[:, i, j, idx+1] = X[:, i, j, idx] + dt * dXdt(X[:, i, j, idx], mu)

    plt.figure(dpi=300)
    plt.plot(T, X[0, 0, 0, :])
    plt.savefig('van_der_pole.png')

    plt.figure(dpi=300)
    for i in range(len(init)):
        for j in range(len(init)):
            plt.plot(X[0, i, j, :], X[1, i, j, :], zorder=1)
            plt.scatter(X[0, i, j, 0], X[1, i, j, 0], color='green', zorder=2, s=[2.0])
            plt.scatter(X[0, i, j, -1], X[1, i, j, -1], color='red', zorder=2, s=[2.0])
    plt.xlabel('x')
    plt.ylabel('y', rotation=0)
    plt.title('Van Der Pol, $\\mu=1.0$')
    plt.savefig('van_der_pole_all.png')

# Network of van der pol
N = 20
epsilon = 0.1
def net():
    def dXdt(X, mu, epsilon, z):
        return np.array([X[1] + epsilon * (z - X[0]), 
                mu * (1 - X[0]**2) * X[1] - X[0]])

    W = np.random.normal(size=(N,N))
    X = np.zeros((2, N, len(T)))
    X[:, :, 0] = np.random.normal(scale=2, size=(2, N))
    def simulate(W, X):
        for idx, t in enumerate(T[1:]):
            z = np.dot(W, X[0, :, idx])
            for i in range(N):
                X[:, i, idx+1] = X[:, i, idx] + dt * dXdt(X[:, i, idx], mu, epsilon, z[i])

    simulate(W, X)
    plt.figure(dpi=300)
    for i in range(N):
        plt.plot(X[0, i, :], X[1, i, :], zorder=1, label=f'n{i+1}')
        plt.scatter(X[0, i, 0], X[1, i, 0], color='green', zorder=2, s=[2.0])
        plt.scatter(X[0, i, -1], X[1, i, -1], color='red', zorder=2, s=[2.0])

    plt.xlabel('x')
    plt.ylabel('y', rotation=0)
    r= stats.pearsonr(X[0, 0, :], X[0, 1, :])[0]
    plt.title(f'Van Der Pol Network, $\\mu={mu}, \\epsilon={epsilon}$, R={r:.3f}')
    plt.legend()
    plt.savefig('van_der_pole_network.png')

    dw = 0.001
    grads = np.zeros((N, N))
    pbar = ProgressBar()
    for i in pbar(range(N)):
        for j in range(N):
            w_init = W[i,j]
            W[i,j] = w_init + dw
            simulate(W, X)          
            r_perb = stats.pearsonr(X[0, 0, :], X[0, 1, :])[0]
            grads[i,j] = (r_perb - r) / dw 
            W[i,j] = w_init # Reset

    plt.figure(dpi=300)
    plt.imshow(grads) 
    plt.savefig('van_der_pole_grads.png')
net()
