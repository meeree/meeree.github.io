#version 450 core

out vec4 color;
in vec2 tex_coords;
uniform sampler2D tex;

void main(void)
{
    color = texture(tex, tex_coords);
}
