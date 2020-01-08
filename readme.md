REST (Representational State Transfer) - a mapping between HTTP routes and CRUD

BLOG:

CREATE  /newBlog
READ    /allBlogs
UPDATE  /updateBlog/:id
DESTROY /destroyBlog/:id


Name            Path            HTTPVerb            Purpose
---------------------------------------------------------------------
Index           /dogs           GET                 List all dogs
New             /dogs/new       GET                 Show new dog form
Create          /dogs           POST                Create new dog, then redirect somewhere
Show            /dogs/:id       GET                 Show info about one specific dog
Edit            /dogs/:id/edit  GET                 Show edit form for one dog
Update          /dogs/:id       PUT                 Update a particular dog, then redirect somewhere
Delete          /dogs/:id       DELETE              Delete a particular dog, then redirect somewhere