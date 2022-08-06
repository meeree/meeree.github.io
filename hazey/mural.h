#include <GLFW/glfw3.h>
#include <string>
#include <vector>

enum Positioning
{
	eRelative, eFixed
};

struct Vec2 
{
	float x, y;
	Vec2(float v = 0.0) : x{v}, y{v} {}
};

struct Widget
{
private:
	int tex_location, sampler_location;

public:
	int tex_w, tex_h;
	std::vector<float> tex_data;
	Vec2 offset, scale;
	Positioning positioning = eRelative;

	Widget(int tex_width, int tex_height, int buffer, int tex_loc, int sampler_loc);
	std::vector<Widget*> children;
	bool render(Widget* parent);
};

struct Window
{
    GLFWwindow* window = nullptr; 
	Widget* widget_root = nullptr;
	unsigned int vao, vbo, shader, texture, sampler;

    Window(int width, int height, std::string title);
    bool render();
};
