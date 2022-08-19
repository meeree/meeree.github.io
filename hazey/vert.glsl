#version 450 core

layout (location=0) in vec2 position;
layout (location=3) uniform vec2 translation;
layout (location=4) uniform vec2 scale;
out vec2 tex_coords;

void main(void)
{
    tex_coords = position;

    vec2 pos = scale * position + translation;

    // [0, 1] -> [-1, 1].
    pos = 2 * pos - 1;
    gl_Position = vec4(pos, 0.0, 1.0);
}
