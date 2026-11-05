"""Render the project's existing model as a transparent sticker. Source blend is read-only."""
import bpy
import sys
from mathutils import Vector
from pathlib import Path

arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not arguments:
    raise SystemExit('Usage: blender --background --python tools/render-character.py -- /path/to/AIWaxGirl_Normal.blend')
source = Path(arguments[0]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
for obj in list(scene.objects):
    if obj.type in {'LIGHT', 'CAMERA'}:
        bpy.data.objects.remove(obj, do_unlink=True)
    elif obj.type == 'ARMATURE':
        obj.animation_data_clear()
        for bone in obj.pose.bones:
            bone.rotation_euler = (0, 0, 0)
            bone.location = (0, 0, 0)
scene.frame_set(1)
world = bpy.data.worlds.new('Web sticker lighting')
world.use_nodes = True
world.node_tree.nodes.clear()
background = world.node_tree.nodes.new('ShaderNodeBackground')
background.inputs[0].default_value = (.15, .17, .19, 1)
background.inputs[1].default_value = .5
output = world.node_tree.nodes.new('ShaderNodeOutputWorld')
world.node_tree.links.new(background.outputs[0], output.inputs[0])
scene.world = world
for location, energy, size in [((-2,-3,4),420,3), ((2,-1,2),180,2), ((0,3,3),450,2)]:
    light = bpy.data.lights.new('Sticker softbox','AREA')
    light.energy = energy
    light.shape = 'DISK'
    light.size = size
    obj = bpy.data.objects.new('Sticker softbox',light)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0,0,.8)) - obj.location).to_track_quat('-Z','Y').to_euler()
camera = bpy.data.cameras.new('Sticker camera')
obj = bpy.data.objects.new('Sticker camera',camera)
scene.collection.objects.link(obj)
obj.location = (.25,-3.3,1.05)
obj.rotation_euler = (Vector((0,0,.76))-obj.location).to_track_quat('-Z','Y').to_euler()
camera.type = 'ORTHO'
camera.ortho_scale = 1.65
scene.camera = obj
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 600
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.render.filepath = str(Path(__file__).resolve().parents[1] / 'assets/yukai-chan.png')
bpy.ops.render.render(write_still=True)
