import numpy as np
import matplotlib.pyplot as plt
from fitting import fit_poly_surface, fill_bilinear_log_difficulty

sets = np.arange(1,11)
reps = np.arange(1,9)
grid = np.stack(np.meshgrid(reps, sets))
vals = np.zeros(grid[0].shape)
vals += np.nan
record = [] # TODO ADD DATE
times = []
print(grid.shape)

def set(s,r,v,m,d,y):
    print(f"Sets: {s} Reps: {r}, Date: {m}/{d}/{y}")
    vals[s-1,r-1] = v
    record.append([s-1, r-1, v])
    from datetime import date
    d = date(y, m, d)
    time = d.timetuple().tm_yday + 365 * (y - 2025)
    times.append(time)

set(10,8,225,3,1,2025)
set(1,8,285,3,1,2025)
set(8,4,275,3,6,2025)
set(7,5,290,3,19,2025)
set(6,6,295,4,3,2025)
set(7,4,305,4,20,2025)
set(1,1,405,5,5,2025)
set(1,3,365,5,5,2025)

set(1,6,315,2,28,2026)
set(10,3,320,3,1,2026)
set(4,8,265,3,2,2026)
set(6,2,335,3,4,2026)
set(4,1,365,3,6,2026)
set(1,4,355,3,13,2026)
set(8,3,330,3,17,2026)
set(1,7,315,3,24,2026)

times = np.array(times)
times = times / times.max() # Calibrate to current time frame.

best_vals = np.copy(vals)
envelope = np.nan_to_num(best_vals)
for i in range(1,vals.shape[0]+1):
    for j in range(1,vals.shape[1]+1):
        envelope[:i, :j] = np.maximum(envelope[i-1,j-1], envelope[:i, :j])

for i in range(4, 10):
    border = (10 - i) + 3
    envelope[i, border:] = np.nan

record = np.array(record).T

plt.figure(figsize = (6, 5))
vmin, vmax = 220, 420
cmap = plt.get_cmap('tab20b')
cmap.set_bad(color='black')
plt.imshow(envelope, interpolation = 'none', origin = 'lower', aspect='auto', cmap = cmap, vmin = vmin, vmax = vmax)

plt.yticks(np.arange(0,vals.shape[0]), np.arange(1,vals.shape[0]+1))
plt.xticks(np.arange(0,vals.shape[1]), np.arange(1,vals.shape[1]+1))
cbar = plt.colorbar(ticks=np.arange(vmin+5, vmax+5+10, 10))

plt.scatter(record[1], record[0], c = times, cmap = 'Wistia', marker='^', s = 80)
#plt.plot([2, 3, 4, 5],[9, 7, 6, 5], c = 'black')
#plt.axvline(2.5, c = 'black', linestyle = 'dashed')
#plt.text(0.5, 2, 'Intens', color = 'red', fontsize = 12)
#plt.text(4, 3, 'Volume', color = 'red', fontsize = 12)
plt.xlabel('Reps', fontsize = 14)
plt.ylabel('Sets', fontsize = 14)
plt.title('Bench PRs To Date', fontsize = 14)

#plt.plot([0, 2, 3, 4],[8, 5, 4, 3], c = 'purple', marker = 'x')
plt.plot([3.5, 3.5], [9.5, 8.5], c = 'white', linewidth = 1)
plt.plot([4.5, 4.5], [8.5, 7.5], c = 'white', linewidth = 1)
plt.plot([5.5, 5.5], [7.5, 6.5], c = 'white', linewidth = 1)
plt.plot([6.5, 6.5], [6.5, 5.5], c = 'white', linewidth = 1)
plt.plot([7.5, 7.5], [5.5, 4.5], c = 'white', linewidth = 1)

plt.plot([3.5, 4.5], [8.5, 8.5], c = 'white', linewidth = 1)
plt.plot([4.5, 5.5], [7.5, 7.5], c = 'white', linewidth = 1)
plt.plot([5.5, 6.5], [6.5, 6.5], c = 'white', linewidth = 1)
plt.plot([6.5, 7.5], [5.5, 5.5], c = 'white', linewidth = 1)
plt.tight_layout()

plt.figure()
plt.subplot(1,1,1,projection='3d')
plt.gca().plot_surface(grid[0], grid[1], envelope, cmap = cmap, vmin = vmin, vmax = vmax)#

# Hardness value fitting. 
#  # Left for future potential use. 
#  # I thought it'd make sense to interp the full grid to make a basline. 
#  # But in reality the only relevant grid values are sets/reps I've done, so don't need other things!
#  percents_lerp = fit_poly_surface(vals.T)[0].T

p = 4. # Distort ratios as x^p, intead of just x. Since benching 315 when max is 325 is basically the same, while benching 225 is like a toy. 
ratios = []
for entry in record.T:
    s, r, w = entry
    best = best_vals[s, r]
    s, r = s+1, r+1 # 0 based to 1 based.
    ratio = (best / w)**p
    ratios.append(ratio)
    print(s, r, ratio)

hist, _, _ = np.histogram2d(times, np.array(ratios), bins = 10, range = [[0, 1], [0, 1]])
#hist, bins = np.histogram(np.array(ratios), bins = 10, range = (0, 1))
#bin_centers = .5 * (bins[:-1] + bins[1:])
#plt.figure()
#plt.plot(bin_centers, hist)

plt.figure()
plt.imshow(hist.T, origin = 'lower', extent = [0, 1, 0, 1], aspect = 'auto', cmap = 'tab10', vmin = -.5, vmax = 9.5)
cbar = plt.colorbar(ticks=np.arange(0, 10, 1))
print(times)
plt.show()
