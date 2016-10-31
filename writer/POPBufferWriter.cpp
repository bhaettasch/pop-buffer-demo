// POPBufferWriter.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"
#include <iostream>

#define TINYOBJLOADER_IMPLEMENTATION // define this in only *one* .cc
#include "tiny_obj_loader.h"

#include <fstream>
using namespace std;

/*
	Structure to hold a record that should be written to file
*/
struct rec
{
	short x, y, z;
	char u, v;
};

/*
	Structure to hold min and max values for transformation
*/
struct minmax
{
	float minx, miny, minz, minu, minv;
	float maxx, maxy, maxz, maxu, maxv;
};

/*
	Structure to hold a vertex entry that is not transformed yet
*/
struct entry
{
	float vx, vy, vz;
	float nx, ny, nz;
	float nu, nv;
};

struct float2 { float u, v; };
struct float3 { float x, y, z; };

/*
	Octahedron normal coding
*/

//TODO Add conversion code here
float wrapOctahedronNormalValue(float v1, float v2)
{
	return (1.0f - fabs(v2)) * (v1 >= 0.0f ? 1.0 : -1.0);
}


void encodeOctahedronNormal(float nx, float ny, float nz, float & octNorU, float & octNorV)
{
	float absSum = fabs(nx) + fabs(ny) + fabs(nz);

	nx /= absSum;
	ny /= absSum;

	if (nz < 0.0f)
	{
		float tmp = nx;
		nx = wrapOctahedronNormalValue(nx, ny);
		ny = wrapOctahedronNormalValue(ny, tmp);
	}

	octNorU = nx * 0.5f + 0.5f;
	octNorV = ny * 0.5f + 0.5f;
}


int main()
{
	const string inputfile = "models/bunny.obj";
	const string modelName = "bunny";
	const char* dataFileName = "bunny.pop";
	const char* metaFileName = "bunny.json";


	/*
		Prepare output file
	*/
	int i;
	FILE *f;
	struct rec r;
	fopen_s(&f, dataFileName, "wb");
	if (!f)
		return 1;


	/*
		Parse obj file
	*/
	cout << "Reading file " << inputfile << endl;

	tinyobj::attrib_t attrib;
	std::vector<tinyobj::shape_t> shapes;
	std::vector<tinyobj::material_t> materials;
	std::string err;

	bool ret = tinyobj::LoadObj(&attrib, &shapes, &materials, &err, inputfile.c_str());
	if (!err.empty()) { // `err` may contain warning message.
		std::cerr << err << std::endl;
	}
	if (!ret || shapes.size() < 1) {
		exit(1);
	}


	// Create a vector to hold the entries
	std::vector<entry> entries;
	int vertexCount = shapes[0].mesh.num_face_vertices.size() * 3;
	std::cout << "Found " << vertexCount << " vertices in file " << inputfile << std::endl;
	entries.reserve(vertexCount);
	int counter = 0;


	// Init min and max values
	minmax minMaxValues;
	minMaxValues.minx = HUGE_VALF;
	minMaxValues.maxx = -HUGE_VALF;
	minMaxValues.miny = HUGE_VALF;
	minMaxValues.maxy = -HUGE_VALF;
	minMaxValues.minz = HUGE_VALF;
	minMaxValues.maxz = -HUGE_VALF;


	/*
		Loop over file content and create output
	*/
	size_t index_offset = 0;
	for (size_t f = 0; f < shapes[0].mesh.num_face_vertices.size(); f++) {
		size_t fv = shapes[0].mesh.num_face_vertices[f];

		// Loop over vertices in the face.
		for (size_t v = 0; v < fv; v++) {
			// access to vertex
			tinyobj::index_t idx = shapes[0].mesh.indices[index_offset + v];

			// create an entry per vertex and update the min and max values if necessary
			entry e;
			e.vx = attrib.vertices[3 * idx.vertex_index + 0];
			if (e.vx < minMaxValues.minx) minMaxValues.minx = e.vx;
			if (e.vx > minMaxValues.maxx) minMaxValues.maxx = e.vx;

			e.vy = attrib.vertices[3 * idx.vertex_index + 1];
			if (e.vy < minMaxValues.miny) minMaxValues.miny = e.vy;
			if (e.vy > minMaxValues.maxy) minMaxValues.maxy = e.vy;

			e.vz = attrib.vertices[3 * idx.vertex_index + 2];
			if (e.vz < minMaxValues.minz) minMaxValues.minz = e.vz;
			if (e.vz > minMaxValues.maxz) minMaxValues.maxz = e.vz;

			// convert normals to octahedron normals
			e.nx = attrib.normals[3 * idx.normal_index + 0];
			e.ny = attrib.normals[3 * idx.normal_index + 1];
			e.nz = attrib.normals[3 * idx.normal_index + 2];
			encodeOctahedronNormal(e.nx, e.ny, e.nz, e.nu, e.nv);

			entries.push_back(e);
			counter++;
		}
		index_offset += fv;
	}


	// Output some debugging values
	std::cout << "MaxX: " << minMaxValues.maxx << " MaxY:" << minMaxValues.maxy << " MaxZ: " << minMaxValues.maxz << std::endl;
	std::cout << "MinX: " << minMaxValues.minx << " MinY:" << minMaxValues.miny << " MinZ: " << minMaxValues.minz << std::endl;


	// Write meta values to meta data file
	ofstream metaFile;
	metaFile.open(metaFileName);
	metaFile << "{\n";
	metaFile << "\"name\": \"" << modelName << "\",\n";
	metaFile << "\"data\": \"" << dataFileName << "\",\n";
	metaFile << "\"numVertices\": \"" << counter << "\",\n";
	metaFile << "\"xmin\": " << minMaxValues.minx << ",\n";
	metaFile << "\"ymin\": " << minMaxValues.miny << ",\n";
	metaFile << "\"zmin\": " << minMaxValues.minz << ",\n";
	metaFile << "\"xmax\": " << minMaxValues.maxx << ",\n";
	metaFile << "\"ymax\": " << minMaxValues.maxy << ",\n";
	metaFile << "\"zmax\": " << minMaxValues.maxz << ",\n";
	metaFile << "\"factor\": " << USHRT_MAX << "\n";
	metaFile << "}\n";
	metaFile.close();


	/*
		Write new values (normalized to range of unsigned short)
	*/
	for (i = 0;i < counter; i++)
	{
		entry e = entries[i];

		r.x = floor((e.vx - minMaxValues.minx) / (minMaxValues.maxx - minMaxValues.minx) * USHRT_MAX);
		r.y = floor((e.vy - minMaxValues.miny) / (minMaxValues.maxy - minMaxValues.miny) * USHRT_MAX);
		r.z = floor((e.vz - minMaxValues.minz) / (minMaxValues.maxz - minMaxValues.minz) * USHRT_MAX);
		r.u = floor(e.nu * UCHAR_MAX);
		r.v = floor(e.nv * UCHAR_MAX);

		fwrite(&r, sizeof(struct rec), 1, f);
	}


	std::cout << "Exported " << counter << " vertices" << std::endl;
	fclose(f);
	cin.get();
}
