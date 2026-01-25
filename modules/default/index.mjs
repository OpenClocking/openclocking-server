export const name = "default"

global.app.get("/", function(req, res) {
    res.render(`./modules/${name}/views/index.ejs`)
})