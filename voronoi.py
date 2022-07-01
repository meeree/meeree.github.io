import numpy as np
from matplotlib import pyplot as plt
from scipy.spatial import Delaunay

points = np.random.rand(100, 2)
tri = Delaunay(points)

plt.figure(dpi=200)
plt.triplot(points[:, 0], points[:, 1], tri.simplices, color='green')
plt.plot(points[:, 0], points[:, 1], 'o', color='black', markersize=3)
plt.savefig('delaunay.png')

from scipy.spatial import Voronoi, voronoi_plot_2d
plt.figure(dpi=200)
vor = Voronoi(points)
voronoi_plot_2d(vor)
plt.savefig('voronoi_python.png')

fig = voronoi_plot_2d(vor)
fig.set_dpi(400)
plt.triplot(points[:, 0], points[:, 1], tri.simplices, color='green')
plt.plot(points[:, 0], points[:, 1], 'o', color='black', markersize=3)
plt.savefig('voronoi_delaunay_python.png')
