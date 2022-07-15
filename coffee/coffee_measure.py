from datetime import timedelta
import cv2
import numpy as np
import os
from matplotlib import pyplot as plt

# From Tutorial: https://www.thepythoncode.com/article/extract-frames-from-videos-in-python

def get_saving_frames_durations(cap, saving_fps):
    """A function that returns the list of durations where to save the frames"""
    s = []
    # get the clip duration by dividing number of frames by the number of frames per second
    clip_duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
    for i in np.arange(0, clip_duration, 1 / saving_fps):
        s.append(i)
    return s

def get_frames(video_file, save_fps):
    # read the video file    
    cap = cv2.VideoCapture(video_file)
    fps = cap.get(cv2.CAP_PROP_FPS)
    saving_frames_per_second = min(fps, save_fps)

    # get the list of duration spots to save
    saving_frames_durations = get_saving_frames_durations(cap, saving_frames_per_second)

    count = 0
    times, frames = [], []
    while True:
        is_read, frame = cap.read()
        if not is_read:
            break

        frame_duration = count / fps
        try:
            closest_duration = saving_frames_durations[0]
        except IndexError:
            break

        if frame_duration >= closest_duration:
            frame = cv2.flip(frame, 0) # Iphone is flipped vertically.
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) # OpenCV uses BGR.
            times.append(frame_duration)
            frames.append(frame)
            try:
                saving_frames_durations.pop(0)
            except IndexError:
                pass
        # increment the frame count
        count += 1
    return times, frames


def coffee_calculate(prefix, fname, box):
    times, frames = get_frames(fname, 30)
    boxed_frames = [frame[box[0,0]:box[1,0], box[0,1]:box[1,1]] for frame in frames]
    print(boxed_frames[0].shape, frames[0].shape)

    inds = np.linspace(0, len(times)-1, 10).astype(int)
    kernel = np.array([[-1, 1]])
    for idx, i in enumerate(inds):
        plt.subplot(2, 5, idx + 1)
        frame = boxed_frames[i]
        plt.imshow(frame)
        plt.title(f't = {times[i]:.1f}')
        plt.xticks([])
        plt.yticks([])
    plt.tight_layout()
    plt.savefig(prefix + 'example_frames.png')

    plt.figure(dpi=300)
    colors = ['red', 'green', 'blue']
    hsl_boxed = [cv2.cvtColor(frame,cv2.COLOR_RGB2HLS) for frame in boxed_frames]
    sums = [np.mean(frame[:, :, 1]) / 255.0 for frame in hsl_boxed]
    fit = np.polyfit(times, sums, 5)
    p = np.poly1d(fit)
    plt.plot(times, sums, color = 'black') 
    plt.plot(times, p(times), color = 'red') 
    plt.savefig(prefix + 'means.png')

box = np.array([[0, 0], [-1, -1]])
coffee_calculate('full1_', './coffee1.MOV', box)

box = np.array([[750, 330], [900, 370]])
coffee_calculate('widebox1_', './coffee1.MOV', box)

box = np.array([[750, 350], [800, 360]])
coffee_calculate('narrowbox1_', './coffee1.MOV', box)

box = np.array([[750, 220], [850, 270]])
coffee_calculate('widebox2_', './coffee2.MOV', box)

box = np.array([[750, 240], [800, 245]])
coffee_calculate('narrowbox2_', './coffee2.MOV', box)
