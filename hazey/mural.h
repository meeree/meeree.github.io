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
	Vec2(float x_, float y_) : x{x_}, y{y_} {}
};

struct IVec2 
{
	int x, y;
	IVec2(int v = 0) : x{v}, y{v} {}
	IVec2(int x_, int y_) : x{x_}, y{y_} {}
};

struct Widget;

struct Window
{
    GLFWwindow* window = nullptr; 
	Widget* widget_root = nullptr;
	unsigned int vao, vbo, shader, sampler;
    int width, height;

    Window(int w, int h, std::string title);

    ///! Handle inputs by delegating to widget tree. 
    void handle_inputs();

    bool render();
};

typedef void (*InputCallback)(Window& window, Widget* widget);

struct Widget
{
protected:
	int sampler_location;

    // Virtual function for handling inputs. By default do nothing.
    virtual void input_callback(Window&) {}

public:
    bool visible = true;
	Vec2 offset, scale;
	Positioning positioning = eRelative;
    Vec2 uv_min, uv_max; // Extents of window in UV space. Updated during rendering.
	std::vector<float> tex_data;
    unsigned int tex_loc;
    int tex_w, tex_h;

	Widget(int tex_width, int tex_height, int buffer, int sampler_loc);
	std::vector<Widget*> children;
	bool render(Widget* parent);
    void update_texture(bool interpolate=true);
    void set_color(float r, float g, float b, float a=1.0);

    ///! Handle inputs e.g. mouse, keyboard by calling input_callback if it is not NULL and then delegating to children.
    void handle_inputs(Window& window);
};
