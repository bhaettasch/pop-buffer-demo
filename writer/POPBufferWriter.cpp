// POPBufferWriter.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"
#include <iostream>

#define TINYOBJLOADER_IMPLEMENTATION // define this in only *one* .cc
#include "tiny_obj_loader.h"

#include <fstream>
using namespace std;

static const unsigned int maxLevel = 16;
static std::vector<unsigned short> PRECOMPUTED_MASKS;

const string inputfile = "models/bunny.obj";
const string modelName = "bunny";
const char* dataFileName = "bunny.pop";
const char* metaFileName = "bunny.json";

/*
	Structure to hold a record that should be written to file
*/
struct rec
{
	unsigned short x, y, z;
	unsigned char u, v;
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

/*
	Octahedron normal coding
*/

float wrapOctahedronNormalValue(float v1, float v2)
{
	return (1.0f - fabs(v2)) * (v1 >= 0.0f ? 1.0 : -1.0);
}


void encodeOctahedronNormal(float nx, float ny, float nz, float & octNorU, float & octNorV)
{
	float absSum = fabs(nx) + fabs(ny) + fabs(nz);

	nx /= absSum;
	ny /= absSum;
	//nz /= absSum; //will always be positive

	if (nz < 0.0f)
	{
		float tmp = nx;
		nx = wrapOctahedronNormalValue(nx, ny);
		ny = wrapOctahedronNormalValue(ny, tmp);
	}

	octNorU = nx * 0.5f + 0.5f;
	octNorV = ny * 0.5f + 0.5f;
}

/*
	Transfer coordinate into level precision
*/
int to_level(int val, int level)
{
	return floor(val/double(PRECOMPUTED_MASKS[level]));
}

/*
	Compares two coordinates for equality (on a given precision level)
*/
bool is_equal(rec r1, rec r2, int level)
{
	return	to_level(r1.x, level) == to_level(r2.x, level) &&
			to_level(r1.y, level) == to_level(r2.y, level) &&
			to_level(r1.z, level) == to_level(r2.z, level) ;
}

/*
	Checks whether a triangle is degenerated (at least two coordinates are the same on the given precision level)
*/
bool is_degenerated(rec r0, rec r1, rec r2, int level)
{
	return is_equal(r0, r1, level) || is_equal(r1, r2, level) || is_equal(r0, r2, level);
}

/*
	Main method: Encode the given model into pop format and output a binary and a json-formatted meta file
*/
int main()
{
	/*
		-----------------------------------------------------------------------------------------------------------------------
		Parse obj file
		-----------------------------------------------------------------------------------------------------------------------
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
		-----------------------------------------------------------------------------------------------------------------------
		Loop over file content and store entries
		-----------------------------------------------------------------------------------------------------------------------
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



	/*
		-----------------------------------------------------------------------------------------------------------------------
		Sort into levels
		-----------------------------------------------------------------------------------------------------------------------
	*/

	// Precompute precision masks
	{
		PRECOMPUTED_MASKS.clear();

		for (int i = 0; i < maxLevel; i++)
		{
			PRECOMPUTED_MASKS.push_back(pow(2, (maxLevel - i - 1)));
		}
	}

	// Create buckets for every level
	std::vector<std::vector<rec>> buckets(maxLevel, std::vector<rec>(0));
	
	// Create records for each entry (normalized to range of unsigned short)
	// and store them in the correct bucket
	for (int i = 0;i < counter; i+= 3)
	{
		rec triangle[3]; 

		// Transform triangle vertices
		for (int k = 0;k < 3;k++)
		{
			entry e = entries[i+k];

			triangle[k].x = floor((e.vx - minMaxValues.minx) / (minMaxValues.maxx - minMaxValues.minx) * USHRT_MAX);
			triangle[k].y = floor((e.vy - minMaxValues.miny) / (minMaxValues.maxy - minMaxValues.miny) * USHRT_MAX);
			triangle[k].z = floor((e.vz - minMaxValues.minz) / (minMaxValues.maxz - minMaxValues.minz) * USHRT_MAX);
			triangle[k].u = floor(e.nu * UCHAR_MAX);
			triangle[k].v = floor(e.nv * UCHAR_MAX);
		}


		// Find the pop up level for this triangle
		int level = maxLevel - 1;
		for (int l = 0;l < maxLevel;l++)
		{
			if (!is_degenerated(triangle[0], triangle[1], triangle[2], l))
			{
				level = l;
				break;
			}
		}
		
		// Store in the correct bucket
		for (int k = 0;k < 3;k++)
		{
			buckets[level].push_back(triangle[k]);
		}
	}

	

	/*
		-----------------------------------------------------------------------------------------------------------------------
		Write meta values to meta data file
		-----------------------------------------------------------------------------------------------------------------------
	*/

	int sum = 0;

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
	metaFile << "\"factor\": " << USHRT_MAX << ",\n";
	metaFile << "\"levelCount\": " << maxLevel << ",\n";
	metaFile << "\"levels\": [";
	for (int l = 0;l < maxLevel-1;l++)
	{
		int current = buckets[l].size();
		sum += current;
		metaFile << sum << ",";
	}
	metaFile << sum + buckets[maxLevel-1].size() << "]\n}\n";
	metaFile.close();

	
	/*
		-----------------------------------------------------------------------------------------------------------------------
		Write new values (sorted by buckets)
		-----------------------------------------------------------------------------------------------------------------------
	*/

	// Prepare output file
	FILE *f;
	struct rec r;
	fopen_s(&f, dataFileName, "wb");
	if (!f)
		return 1;

	//For each bucket...
	for (int b = 0;b < maxLevel; b++)
	{
		vector<rec> bucket = buckets[b];

		// ...write transformed triangle vertices
		for (int i = 0;i < bucket.size();i++)
		{
			rec r = bucket[i];
			fwrite(&r, sizeof(struct rec), 1, f);
		}
	}


	std::cout << "Exported " << counter << " vertices" << std::endl;
	fclose(f);
}
