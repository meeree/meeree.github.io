#version 450 core

layout (location=0) in vec2 position;
layout (location=3) uniform vec2 translation;
layout (location=4) uniform vec2 scale;
out vec2 tex_coords;

void main(void)
{
    // [-1, 1] -> [0, 1].
    tex_coords = 0.5 * (position + 1.0);
    gl_Position = vec4(scale * position + translation, 0.0, 1.0);
}
