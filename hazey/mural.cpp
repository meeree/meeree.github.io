#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <cmath>
#include "mural.h"
#include <stdexcept>
#include <memory>
#include <iostream>
#include <fstream>
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

void initShaders (char const* vertLoc, char const* fragLoc, GLuint& shader_prog);

Window::Window(int w, int h, std::string title)
{
    width = w;
    height = h;
	bool status = glfwInit();
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2);
    glfwWindowHint(GLFW_DECORATED, false); // Turn off title bar.
    window = glfwCreateWindow(width, height, title.c_str(), nullptr, nullptr);
    if(!status || !window)
        throw std::runtime_error("ERROR: Couldn't open window: " + title);
	glfwMakeContextCurrent(window);

	glewExperimental = GL_TRUE;
    if(glewInit() != 0)
        throw std::runtime_error("ERROR: Couldn't init GLEW");
    glGetError();
	initShaders("vert.glsl", "frag.glsl", shader);

	glGenVertexArrays(1, &vao);
	glBindVertexArray(vao);
	glGenBuffers(1, &vbo);
	glBindBuffer(GL_ARRAY_BUFFER, vbo);
	glUseProgram(shader);
	sampler = glGetUniformLocation(shader, "tex");

    // Setting a user pointer allows us to access the wrapper Window class just from the GLFWwindow.
    // This is needed with callbacks and stuff that take functions, not member functions.
    glfwSetWindowUserPointer(window, reinterpret_cast<void *>(this));

	// Position attribute.
	glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, NULL);
	glEnableVertexAttribArray(0);
}

bool Window::render()
{
    if(glfwWindowShouldClose(window))
        return false;

	glfwMakeContextCurrent(window);
    GLfloat const color[4]{ 0.0f, 0.0f, 0.0f, 1.0f };
    glClearBufferfv(GL_COLOR, 0.0f, color);
    glClear(GL_DEPTH_BUFFER_BIT);
	if(widget_root)
		if(!widget_root->render(nullptr))
			return false;

	glfwPollEvents();
    handle_inputs();
	glfwSwapBuffers(window);
	return true;
}

Widget::Widget(int tex_width, int tex_height, int buffer, int sampler_loc)
{
	scale = Vec2(1.0);
	tex_w = tex_width;
	tex_h = tex_height;
	sampler_location = sampler_loc;
	float vertices[12]{
		0, 0, 
		1, 0, 
		1, 1,
		0, 0, 
		1, 1, 
		0, 1
	};
	glBindBuffer(GL_ARRAY_BUFFER, buffer);
	glBufferData(GL_ARRAY_BUFFER,
			12 * sizeof(float),
			vertices,
			GL_DYNAMIC_DRAW);
    uv_min.x = 0;
    uv_min.y = 0;
    uv_max.x = 1;
    uv_max.y = 1;

	tex_data.resize(tex_width * tex_height * 3, 0.0); // RGB float colors
	glActiveTexture(GL_TEXTURE0);
	glGenTextures(1, &tex_loc);
	update_texture();
}

void Widget::update_texture()
{
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, tex_loc);
	glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, tex_w, tex_h, 0, GL_RGB, GL_FLOAT, tex_data.data());
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
}

bool Widget::render(Widget* parent)
{
	glBindTexture(GL_TEXTURE_2D, tex_loc);
	glUniform1i(sampler_location, 0);

	//TODO: DONT HARDCODE UNIFORM
    Vec2 cur_scale = scale, cur_offset = offset;
	if(parent && positioning == eRelative)
	{
        cur_scale.x = parent->scale.x * scale.x;
        cur_scale.y = parent->scale.y * scale.y;
        cur_offset.x = parent->scale.x * offset.x + parent->offset.x;
        cur_offset.y = parent->scale.y * offset.y + parent->offset.y;
	}
    glUniform2f(3, cur_offset.x, cur_offset.y);
    glUniform2f(4, cur_scale.x, cur_scale.y);
	glDrawArrays(GL_TRIANGLES, 0, 6);

    // Update extents stored.
    uv_min = cur_offset;
    uv_max.x = cur_scale.x + cur_offset.x;
    uv_max.y = cur_scale.y + cur_offset.y;

	// Render children.
	bool status = (glGetError() == GL_NO_ERROR);
	for(auto& child: children)
		status &= child->render(this);
	return true;
}

void Widget::handle_inputs(Window& window)
{
    input_callback(window);
    for(auto& child: children)
        child->handle_inputs(window);
}

void Window::handle_inputs()
{
    if(widget_root)
        widget_root->handle_inputs(*this);
}

inline Vec2 get_mouse_pos_screen(Window& window)
{
    double xpos, ypos;
    glfwGetCursorPos(window.window, &xpos, &ypos);
    return Vec2(xpos, ypos);
}

inline Vec2 screen_coords_to_uv(Window& window, Vec2 pos)
{
    pos.x = pos.x / window.width;
    pos.y = 1 - pos.y / window.height;
    return pos;
}

inline Vec2 uv_to_relative_uv(Widget& widget, Vec2 pos)
{
    pos.x = (pos.x - widget.uv_min.x) / (widget.uv_max.x - widget.uv_min.x);
    pos.y = (pos.y - widget.uv_min.y) / (widget.uv_max.y - widget.uv_min.y);
    return pos;
}

void Widget::set_color(float r, float g, float b) 
{
    struct float3{float x; float y; float z;};
    std::fill((float3*)tex_data.data(), (float3*)tex_data.data() + tex_data.size()/3, float3{r,g,b});
    update_texture();
}

// Solid border around group of widgets.
struct GroupWidget : public Widget 
{
	GroupWidget(Window& window)
		: Widget(1000, 1000, window.vbo, window.sampler)
	{
		for(int j = 0; j < tex_h; ++j)
		{
			for(int i = 0; i < tex_w; ++i)
			{
				int idx = j * tex_w + i;
				float t1 = 1 - 2 * i / float(tex_w - 1);
				float t2 = 1 - 2 * j / float(tex_h - 1);
				float ang = atan2(t2, t1);
				float v = pow(t1, 10) + pow(t2, 10);
				float col = 0.0;
				if(v > pow(0.99, 10) && v < pow(0.997, 10))
					col = 1.0;
				tex_data[3 * idx + 0] = col;
				tex_data[3 * idx + 1] = col;
				tex_data[3 * idx + 2] = col;
			}
		}
		update_texture();
	}
};

struct SliderWidget : public Widget
{
private:
    bool selected = false;
    Widget* slider_bar;

public:
    float height = 0; // Value between 0 and 1 
    SliderWidget(Window& window)
        : Widget(1, 1, window.vbo, window.sampler)
    {
		set_color(0.6, 0.6, 0.6);
        slider_bar = new Widget(1, 1, window.vbo, window.sampler);
        slider_bar->set_color(1.0, 1.0, 1.0);
        children.push_back(slider_bar);
        slider_bar->scale.y = 0.03;
		slider_bar->offset.y = height - slider_bar->scale.y * 0.5;
    }

    virtual void input_callback(Window& window) override 
    {
        auto stat = glfwGetMouseButton(window.window, GLFW_MOUSE_BUTTON_LEFT);
        if(stat != GLFW_PRESS)
        {
            selected = false;
            return;
        }

        // If not selected, first check if mouse is in the widget at all.
		// TODO: THIS SHOULD BE DELEGATED BY SOMETHING UP THE CHAIN.
        Vec2 screen_pos = get_mouse_pos_screen(window);
        Vec2 uv = screen_coords_to_uv(window, screen_pos);
        uv = uv_to_relative_uv(*this, uv);

		if(selected
		  || (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0))
		{
			selected = true;
			height = std::max<float>(std::min<float>(uv.y, 1.0), 0.0);
			slider_bar->offset.y = height - slider_bar->scale.y * 0.5;
		}
    }
};

struct ColorBarWidget : public Widget
{
private:
    bool selected = false;
	Widget* selector;
    int s_tex_w, s_tex_h;

public:
	float r = 1.0, g = 0.0, b = 0.0;
    ColorBarWidget(Window& window)
        : Widget(1, 1, window.vbo, window.sampler),
        s_tex_w{300}, s_tex_h{300}
    {
        selector = new Widget(s_tex_w, s_tex_h, window.vbo, window.sampler);
        children.push_back(selector);

		// Make triangle color selector.
		for(int j = 0; j < s_tex_h; ++j)
		{
			for(int i = j; i < s_tex_w; ++i)
			{
				int idx = j * s_tex_w + i;
				float t1 = 1 - i / float(s_tex_w - 1);
				float t2 = j / float(s_tex_h - 1);
				float t3 = 1.0 - t1 - t2;
				selector->tex_data[3 * idx + 0] = t1;
				selector->tex_data[3 * idx + 1] = t2;
				selector->tex_data[3 * idx + 2] = t3;
			}
		}
        selector->update_texture();
        selector->offset.y = 0.1;
        selector->scale.y = 0.9;
        set_color(r, g, b);
    }

    virtual void input_callback(Window& window) override 
    {
        auto stat = glfwGetMouseButton(window.window, GLFW_MOUSE_BUTTON_LEFT);
        if(stat != GLFW_PRESS)
        {
            selected = false;
            return;
        }

        // If not selected, first check if mouse is in the widget at all.
		// TODO: THIS SHOULD BE DELEGATED BY SOMETHING UP THE CHAIN.
        Vec2 screen_pos = get_mouse_pos_screen(window);
        Vec2 uv = screen_coords_to_uv(window, screen_pos);
        uv = uv_to_relative_uv(*selector, uv);

		if(selected
		  || (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0))
		{
			selected = true;
			int i = (s_tex_w - 1) * std::max<float>(std::min<float>(uv.x, 1.0), 0.0);
			int j = (s_tex_h - 1) * std::max<float>(std::min<float>(uv.y, 1.0), 0.0);
			int idx = j * s_tex_w + i;
			r = selector->tex_data[3 * idx + 0];
			g = selector->tex_data[3 * idx + 1];
			b = selector->tex_data[3 * idx + 2];
			set_color(r, g, b);
		}
    }
};

struct DrawWidget : public Widget
{
private:
	float pen_r = 0.0, pen_g = 0.0, pen_b = 0.0;
    float pen_w = 0.1;

public:
    DrawWidget(Window& window, int tex_width, int tex_height)
        : Widget(tex_width, tex_height, window.vbo, window.sampler)
    {
        set_color(1.0, 1.0, 1.0);
    }

    void set_pen_from_colorbar (ColorBarWidget* widget) 
    {
        pen_r = widget->r;
        pen_g = widget->g;
        pen_b = widget->b;
    }

    void set_pen_width_from_slider (SliderWidget* widget) 
    {
        pen_w = widget->height;
    }

    virtual void input_callback(Window& window) override 
    {
        auto stat = glfwGetMouseButton(window.window, GLFW_MOUSE_BUTTON_LEFT);
        if(stat != GLFW_PRESS)
            return;

		// TODO: THIS SHOULD BE DELEGATED BY SOMETHING UP THE CHAIN.
        Vec2 screen_pos = get_mouse_pos_screen(window);
        Vec2 uv = screen_coords_to_uv(window, screen_pos);
        uv = uv_to_relative_uv(*this, uv);

        // selected ONLY if in bounds.
		bool in_bounds = (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0);
        if(in_bounds)
		{
			int i = (tex_w - 1) * uv.x;
			int j = (tex_h - 1) * uv.y;
            int spread = 10 * pen_w;
            for(int i1 = i - spread; i1 < i + spread; ++i1)
            {
                for(int j1 = j - spread; j1 < j + spread; ++j1)
                {
                    if(i1 < 0 || i1 >= tex_w || j1 < 0 || j1 >= tex_h)
                        continue;
                    int idx = j1 * tex_w + i1;
                    tex_data[3 * idx + 0] = pen_r;
                    tex_data[3 * idx + 1] = pen_g;
                    tex_data[3 * idx + 2] = pen_b;
                }
            }
            update_texture();
		}
    }
};

int main()
{
	auto window = Window(900, 900, "Test");
	GroupWidget widget(window);
	window.widget_root = &widget;

	SliderWidget widget2(window);
	widget2.offset.x = 0.1;
	widget2.offset.y = 0.1;
	widget2.scale.x = 0.3;
	widget2.scale.y = 0.85;
	widget.children.push_back(&widget2);

	ColorBarWidget widget3(window);
	widget3.offset.x = 0.5;
	widget3.offset.y = 0.1;
	widget3.scale.x = 0.4;
	widget3.scale.y = 0.4;
	widget.children.push_back(&widget3);

	DrawWidget widget4(window, 300, 300);
	widget4.offset.x = 0.5;
	widget4.offset.y = 0.55;
	widget4.scale.x = 0.4;
	widget4.scale.y = 0.4;
	widget.children.push_back(&widget4);

	for(int t = 0;;t++)
	{
        widget4.set_pen_from_colorbar(&widget3);
        widget4.set_pen_width_from_slider(&widget2);
		if(!window.render())
			break;
	}
}

GLuint loadInShader(GLenum const &shaderType, char const *fname) {
   std::vector<char> buffer;
   std::ifstream in;
   in.open(fname, std::ios::binary);

   if (in.is_open()) {
      in.seekg(0, std::ios::end);
      size_t const &length = in.tellg();

      in.seekg(0, std::ios::beg);

      buffer.resize(length + 1);
      in.read(&buffer[0], length);
      in.close();
      buffer[length] = '\0';
   } else {
      std::cerr << "Unable to open " << fname << std::endl;
      exit(-1);
   }

   GLchar const *src = &buffer[0];

   GLuint shader = glCreateShader(shaderType);
   glShaderSource(shader, 1, &src, NULL);
   glCompileShader(shader);
   GLint test;
   glGetShaderiv(shader, GL_COMPILE_STATUS, &test);

   if (!test) {
      std::cerr << "Shader compilation failed with this message:" << std::endl;
      std::vector<char> compilationLog(512);
      glGetShaderInfoLog(shader, compilationLog.size(), NULL, &compilationLog[0]);
      std::cerr << &compilationLog[0] << std::endl;
      glfwTerminate();
      exit(-1);
   }

   return shader;
}

void initShaders (char const* vertLoc, char const* fragLoc, GLuint& shader_prog)
{   
    shader_prog = glCreateProgram();

    auto vertShader = loadInShader(GL_VERTEX_SHADER, vertLoc);
    auto fragShader = loadInShader(GL_FRAGMENT_SHADER, fragLoc);

    glAttachShader(shader_prog, vertShader);
    glAttachShader(shader_prog, fragShader);

    glDeleteShader(vertShader);
    glDeleteShader(fragShader);

    glLinkProgram(shader_prog);
}
