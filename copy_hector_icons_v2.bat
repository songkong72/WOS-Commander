@echo off
cd assets\images\skill-icons
@REM Copy varied icons (from other heroes) to Hector's file names to avoid duplicates of Edith's icons
copy /Y hero_skill_icon_500111.png hero_skill_icon_501511.png
copy /Y hero_skill_icon_500112.png hero_skill_icon_501512.png
copy /Y hero_skill_icon_500113.png hero_skill_icon_501513.png
copy /Y hero_skill_icon_500214.png hero_skill_icon_501514.png
copy /Y hero_skill_icon_500215.png hero_skill_icon_501515.png
copy /Y hero_skill_icon_500216.png hero_skill_icon_501516.png
@REM Use a skill icon as equipment icon since we lack a high-res equipment icon other than Edith's
copy /Y hero_skill_icon_500211.png equipment_icon_1050151.png
copy /Y hero_skill_icon_500114.png hero_skill_icon_501517.png
copy /Y hero_skill_icon_500115.png hero_skill_icon_501518.png
echo Done
