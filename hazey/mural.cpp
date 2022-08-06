#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <cmath>
#include "mural.h"
#include <stdexcept>
#include <iostream>
#include <fstream>
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

void initShaders (char const* vertLoc, char const* fragLoc, GLuint& shader_prog);

Window::Window(int width, int height, std::string title)
{
	bool status = glfwInit();
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2);
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
	glGenTextures(1, &texture);
	sampler = glGetUniformLocation(shader, "tex");

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
	glfwSwapBuffers(window);
	return true;
}

Widget::Widget(int tex_width, int tex_height, int buffer, int tex_loc, int sampler_loc)
{
	scale = Vec2(1.0);
	tex_location = tex_loc;
	tex_w = tex_width;
	tex_h = tex_height;
	sampler_location = sampler_loc;
	tex_data.resize(tex_width * tex_height * 3, 0.0); // RGB float colors
	float vertices[12]{
		-1, -1, 
		 1, -1, 
		 1,  1,
		-1, -1, 
		 1,  1, 
		-1,  1
	};
	glBindBuffer(GL_ARRAY_BUFFER, buffer);
	glBufferData(GL_ARRAY_BUFFER,
			12 * sizeof(float),
			vertices,
			GL_DYNAMIC_DRAW);
}

bool Widget::render(Widget* parent)
{
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, tex_location);
	glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, tex_w, tex_h, 0, GL_RGB, GL_FLOAT, tex_data.data());
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glUniform1i(sampler_location, 0);

	//TODO: DONT HARDCORE UNIFORM
	if(parent && positioning == eRelative)
	{
		glUniform2f(3, offset.x + parent->offset.x, offset.y + parent->offset.y);
		glUniform2f(4, scale.x * parent->scale.x, scale.y * parent->scale.y);
	}
	else
	{
		glUniform2f(3, offset.x, offset.y);
		glUniform2f(4, scale.x, scale.y);
	}
	glDrawArrays(GL_TRIANGLES, 0, 6);

	// Render children.
	bool status = (glGetError() == GL_NO_ERROR);
	for(auto& child: children)
		status &= child->render(this);
	return true;
}

int main()
{
	auto window = Window(500, 300, "Test");
	Widget widget(1000, 1000, window.vbo, window.texture, window.sampler);
	window.widget_root = &widget;

	// Add border to widget.
	for(int i = 0; i < widget.tex_w; ++i)
	{
		for(int j = 0; j < widget.tex_h; ++j)
		{
			float x = i / float(widget.tex_w-1), y = j / float(widget.tex_h-1);
			x = 2 * x - 1; y = 2 * y - 1;
			float v = pow(x, 8) + pow(y, 8);
			if(v > 0.9)
			{
				widget.tex_data[3 * (i * widget.tex_h + j)] = 1.0;
				widget.tex_data[3 * (i * widget.tex_h + j)+1] = 1.0;
				widget.tex_data[3 * (i * widget.tex_h + j)+2] = 1.0;
			}
		}
	}

	Widget widget2(300, 500, window.vbo, window.texture, window.sampler);
	std::fill(widget2.tex_data.begin(), widget2.tex_data.end(), 0.3);
	widget2.offset.x = 0.1;
	widget2.offset.y = 0.1;
	widget2.scale.x = 0.3;
	widget2.scale.y = 0.5;
	widget.children.push_back(&widget2);

	auto window2 = Window(500, 700, "Test2");
	Widget widget3(1000, 1000, window2.vbo, window2.texture, window2.sampler);
	window2.widget_root = &widget3;

	for(int i = 0; i < widget3.tex_w; ++i)
	{
		for(int j = 0; j < widget3.tex_h; ++j)
		{
			float x = i / float(widget3.tex_w-1), y = j / float(widget3.tex_h-1);
			x = 2 * x - 1; y = 2 * y - 1;
			float v = pow(x, 2) + pow(y, 2);
			if(v > 0.5)
			{
				widget3.tex_data[3 * (i * widget3.tex_h + j)] = 1.0;
				widget3.tex_data[3 * (i * widget3.tex_h + j)+1] = 0.0;
				widget3.tex_data[3 * (i * widget3.tex_h + j)+2] = 1.0;
			}
		}
	}

	int width, height, channels;
    unsigned char *img = stbi_load("mural_logo.png", &width, &height, &channels, 0);
    if(img == NULL) {
        printf("Error in loading the image\n");
        exit(1);
    }

	auto window3 = Window(width, height, "Test2");
	Widget widget4(width, height, window2.vbo, window2.texture, window2.sampler);
	for(int i = 0; i < width; ++i)
	{
		for(int j = 0; j < height; ++j)
		{
			int idx = j * width + i;
			int flip_idx = (height - 1 - j) * width + i;
			widget4.tex_data[3 * idx] = float(img[4 * flip_idx]) / UCHAR_MAX;
			widget4.tex_data[3 * idx+1] = float(img[4 * flip_idx+1]) / UCHAR_MAX;
			widget4.tex_data[3 * idx+2] = float(img[4 * flip_idx+2]) / UCHAR_MAX;
		}
	}
	window3.widget_root = &widget4;

	for(int t = 0;;t++)
	{
		int r1 = 0.5 * (sin(0.01*t) + 1) * widget2.tex_h;
		int r2 = std::min<float>(0.5 * (sin(0.01*t) + 1) + 0.05, 1) * widget2.tex_h;
		std::fill(widget2.tex_data.begin(), widget2.tex_data.end(), 0.3);

		std::fill(widget2.tex_data.begin() + 3*r1*widget2.tex_w, widget2.tex_data.begin() + 3*r2*widget2.tex_w, 1.0);

		if(!window.render())
			break;
		if(!window2.render())
			break;
		if(!window3.render())
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
