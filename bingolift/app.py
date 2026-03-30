from io import BytesIO

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from flask import Flask, Response, render_template, request
import numpy as np

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


def my_grid(df, vmin=None, vmax=None, increment=10):
    sets = np.arange(1, 11)
    reps = np.arange(1, 9)
    grid = np.stack(np.meshgrid(reps, sets))
    vals = np.zeros(grid[0].shape)
    vals += np.nan
    record = []
    times = []

    def add_point(s, r, v, m, d, y):
        print(f"Sets: {s} Reps: {r}, Date: {m}/{d}/{y}")
        vals[s - 1, r - 1] = v
        record.append([s - 1, r - 1, v])

        from datetime import date
        dt = date(y, m, d)
        time = dt.timetuple().tm_yday + 365 * (y - 2025)
        times.append(time)

    for _, row in df.iterrows():
        add_point(
            int(row["sets"]),
            int(row["reps"]),
            float(row["weight"]),
            int(row["date"].month),
            int(row["date"].day),
            int(row["date"].year),
        )

    times = np.array(times, dtype=float)
    if len(times) > 0 and times.max() > 0:
        times = times / times.max()

    best_vals = np.copy(vals)
    envelope = np.nan_to_num(best_vals)
    for i in range(1, vals.shape[0] + 1):
        for j in range(1, vals.shape[1] + 1):
            envelope[:i, :j] = np.maximum(envelope[i - 1, j - 1], envelope[:i, :j])

    # Auto-detect bounds from real values if user leaves them blank
    finite_vals = envelope[np.isfinite(envelope)]
    if finite_vals.size == 0:
        auto_vmin, auto_vmax = 0, 100
    else:
        auto_vmin = int(np.floor(finite_vals.min() / increment) * increment)
        auto_vmax = int(np.ceil(finite_vals.max() / increment) * increment)

    if vmin is None:
        vmin = auto_vmin
    if vmax is None:
        vmax = auto_vmax

    if vmax <= vmin:
        vmax = vmin + increment

    fig = plt.figure(figsize=(6, 5))
    cmap = plt.get_cmap("tab20b").copy()
    cmap.set_bad(color="black")

    clipped = envelope.copy()
    clipped[clipped > vmax] = np.nan
    clipped[clipped < vmin] = np.nan

    plt.imshow(
        clipped,
        interpolation="none",
        origin="lower",
        aspect="auto",
        cmap=cmap,
        vmin=vmin,
        vmax=vmax,
    )

    plt.yticks(np.arange(0, vals.shape[0]), np.arange(1, vals.shape[0] + 1))
    plt.xticks(np.arange(0, vals.shape[1]), np.arange(1, vals.shape[1] + 1))
    plt.colorbar(ticks=np.arange(vmin + increment/2, vmax + 3*increment/2, increment))

    if len(record) > 0:
        record = np.array(record).T
        plt.scatter(record[1], record[0], c=times, cmap="Wistia", marker="^", s=80)

    plt.xlabel("Reps", fontsize=14)
    plt.ylabel("Sets", fontsize=14)
    plt.title("PR Bingo Chart", fontsize=14)
    plt.tight_layout()
    return fig


@app.route("/plot.png", methods=["POST"])
def plot_png():
    try:
        data = request.get_json()

        if not data or "lifts" not in data:
            return Response("Missing lift data.", status=400)

        lifts = data["lifts"]
        if not lifts:
            return Response("No lifts provided.", status=400)

        controls = data.get("controls", {})
        vmin = controls.get("vmin")
        vmax = controls.get("vmax")
        increment = controls.get("increment", 10)

        vmin = None if vmin in ("", None) else float(vmin)
        vmax = None if vmax in ("", None) else float(vmax)
        increment = 10 if increment in ("", None) else float(increment)

        if increment <= 0:
            return Response("Increment must be positive.", status=400)

        df = pd.DataFrame(lifts)

        required_cols = {"date", "weight", "sets", "reps"}
        if not required_cols.issubset(df.columns):
            return Response("Lift data missing required fields.", status=400)

        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df["weight"] = pd.to_numeric(df["weight"], errors="coerce")
        df["sets"] = pd.to_numeric(df["sets"], errors="coerce")
        df["reps"] = pd.to_numeric(df["reps"], errors="coerce")

        df = df.dropna(subset=["date", "weight", "sets", "reps"]).copy()

        if df.empty:
            return Response("No valid lift data after parsing.", status=400)

        df = df.sort_values("date")

        fig = my_grid(df, vmin=vmin, vmax=vmax, increment=increment)

        buf = BytesIO()
        fig.savefig(buf, format="png", dpi=150)
        plt.close(fig)
        buf.seek(0)

        return Response(buf.getvalue(), mimetype="image/png")

    except Exception as e:
        return Response(f"Error generating plot: {str(e)}", status=500)


if __name__ == "__main__":
    app.run(debug=True)
