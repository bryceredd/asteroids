var Asteroid = function(canvas) {  
    var game = this

    // game balance
    var base_showcards = 3
    var additional_showcards_per_level = 1
    var max_actors_per_showcard = 4
    var points_per_showcard_dead = 300
    var points_per_actor_dead = 100
    var points_per_shot = -12
    var points_per_second = -10
    var fire_repeat_rate = 300 // in miliseconds

    // user data constants
    var type_dead = 1
    var type_bullet = 2
    var type_player = 3
    var type_player_invulnerable = 4
    var type_asteroid = 5
    var type_asteroid_child = 6
    var type_dead_asteroid = 7


    // instance vars
    var player = null
    var world = null
    var level = 1
    var score = 0
    var ctx = canvas.getContext('2d')

     var   b2Vec2 = Box2D.Common.Math.b2Vec2
        ,  b2AABB = Box2D.Collision.b2AABB
            ,       b2BodyDef = Box2D.Dynamics.b2BodyDef
            ,       b2Body = Box2D.Dynamics.b2Body
            ,       b2FixtureDef = Box2D.Dynamics.b2FixtureDef
            ,       b2Fixture = Box2D.Dynamics.b2Fixture
            ,       b2World = Box2D.Dynamics.b2World
            ,       b2MassData = Box2D.Collision.Shapes.b2MassData
            ,       b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape
            ,       b2CircleShape = Box2D.Collision.Shapes.b2CircleShape
            ,       b2DebugDraw = Box2D.Dynamics.b2DebugDraw
            ,	b2Contact = Box2D.Dynamics.Contacts
        ,  b2MouseJointDef =  Box2D.Dynamics.Joints.b2MouseJointDef

        var updateTimer, checkTimer
            
    createMenu()


    
    function imagesForLevel(level, cb) {

        var images = []
        var imageList = this.imageList || []
        var totalImages = level*additional_showcards_per_level+base_showcards
        var loadedImages = 0

        console.log('loading '+totalImages)

	// hack for now
	for(var i=0; i<totalImages; i++) {
            var image = new Image()

            image.onload = function() { 

                if(++loadedImages == totalImages) { cb(images) }
            }

            images[i] = image

            image.src = "http://lorempixum.com/96/128?nocache" + i + new Date().getTime()
        }
    }


    function createMenu() {
        ctx.clearRect(0,0,canvas.width, canvas.height)
        $(canvas).bind("mouseup", function(e) {})

        ctx.fillStyle = "#FFF"

        ctx.font = "34px HelveticaNeue"
	ctx.fillText("Click to Start", canvas.width/2-100, canvas.height/2-10)

        ctx.font = "22px HelveticaNeue"
        ctx.fillText("(Arrows to move, Space to shoot)", canvas.width/2-100, canvas.height/2+20)

	$(canvas).bind("mouseup", function(e) {
		if(world) return

		$(canvas).bind("mouseup", function(e){})
                ctx.clearRect(0,0,canvas.width, canvas.height)
                ctx.fillText("Loading images...", canvas.width/2-100, canvas.height/2-10)

		imagesForLevel(level, function(images) {
			createWorldWithImages(images)
		})
	})
    }

    function createEndScreen(didWin) {
        if(didWin && game.levelComplete) 
            game.levelComplete(level, score)
        if(!didWin && game.levelFailed) 
            game.levelFailed(level, score)


        ctx.clearRect(0,0,canvas.width, canvas.height)
        ctx.fillStyle = "#FFF"
        ctx.font = "34px HelveticaNeue"
        ctx.fillText(didWin?"Level "+level+" Cleared!":"Dead", canvas.width/2-100, canvas.height/2-10)
        ctx.font = "22px HelveticaNeue"
        ctx.fillText(didWin?"Click to Continue":"Click to Restart Level", canvas.width/2-100, canvas.height/2+20)

        if(didWin) level++
    }

    function createWorldWithImages(images) {

	console.log("images:!", images)
        // setup the new world

         world = new b2World(
               new b2Vec2(0, 0)    //gravity
            ,  true                 //allow sleep
         );

        var debugDraw = new b2DebugDraw();
	debugDraw.SetSprite(canvas.getContext("2d"));
	debugDraw.SetDrawScale(30.0)
	debugDraw.SetFillAlpha(0.5)
	debugDraw.SetLineThickness(1.0)
	debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit)
	world.SetDebugDraw(debugDraw)

         
        world.SetContactListener({
            EndContact: function() {}, 
            BeginContact: function(contact) {
                    var body1 = contact.GetFixtureA().GetBody()
                    var body2 = contact.GetFixtureB().GetBody()
		
                    var type1 = body1.GetUserData().type
                    var type2 = body2.GetUserData().type

                    var image1 = body1.GetUserData().image
                    var image2 = body2.GetUserData().image
		
                    if(type1 == type_bullet && type2 == type_asteroid) {
                            body1.SetUserData({type:type_dead})
                            body2.SetUserData({type:type_dead_asteroid, image:image2})
                            score += points_per_showcard_dead 
                    } 
                    
                    if(type1 == type_asteroid && type2 == type_bullet) {
                            body1.SetUserData({type:type_dead_asteroid, image:image1})
                            body2.SetUserData({type:type_dead})
                            score += points_per_showcard_dead
                    }

                    if(type1 == type_bullet && type2 == type_asteroid_child || type1 == type_asteroid_child && type2 == type_bullet) {
                            body1.SetUserData({type:type_dead})
                            body2.SetUserData({type:type_dead})
                            score += points_per_actor_dead
                    }

                    if(type2 == type_player && (type1 == type_asteroid_child || type1 == type_asteroid)) {
                            body2.SetUserData({type:type_dead})
                            player = null
                    }
                    if(type1 == type_player && (type2 == type_asteroid_child || type2 == type_asteroid)) {
                            body1.SetUserData({type:type_dead})
                            player = null
                    }
            },
            PreSolve: function(contact, manifold) { },
            PostSolve: function() {}
        })

        updateTimer = window.setInterval(update, 1000 / 60)
        checkTimer = window.setInterval(function() {

            score += points_per_second

            if(shouldEndGame()) {
                destroyWorld()
                createEndScreen(player)
                score = 0
            }

        }, 1000)

         for(var i=0; i<images.length; i++) {
                createAsteroidWithImage(images[i])
         }

         player = createPlayer()
     }

     function destroyWorld() {
            clearInterval(updateTimer)
            clearInterval(checkTimer)
            world = null
     }

     function createAsteroidWithImage(image) {

         var fixDef = new b2FixtureDef
         fixDef.density = 1.0
         fixDef.friction = 0.5
         fixDef.restitution = 1.0 // its important to keep all the kinetic energy in the game at a constant
         
         var bodyDef = new b2BodyDef
         bodyDef.type = b2Body.b2_dynamicBody

         fixDef.shape = new b2PolygonShape
         fixDef.shape.SetAsBox( 
                1.5, //half width
                2 //half height
         )

        bodyDef.position.x = Math.random() * canvas.width
        bodyDef.position.y = Math.random() * canvas.height
        var asteroid = world.CreateBody(bodyDef)
        asteroid.SetUserData({type:type_asteroid, image:image})
        asteroid.CreateFixture(fixDef);
        asteroid.ApplyForce(new b2Vec2(Math.random()*3000-1500,Math.random()*3000-1500), bodyDef.position) // up
        asteroid.SetPositionAndAngle(bodyDef.position, Math.random()*6.28)
        asteroid.ApplyTorque((Math.random()-.5)*2000)
    }

    function createSmallAsteroids(image, position, angle) {

        for(var i=0; i<max_actors_per_showcard; i++) {

            var size = {width:1.5, height:2}
            var rotated_x = Math.cos(angle+(3.14/2*i)+3.14/4)*size.width/2
            var rotated_y = Math.sin(angle+(3.14/2*i)+3.14/4)*size.height/2

            var fixDef = new b2FixtureDef
            fixDef.density = 1.0
            fixDef.friction = 0.5
            fixDef.restitution = 1.0
         
            var bodyDef = new b2BodyDef
            bodyDef.type = b2Body.b2_dynamicBody
            fixDef.shape = new b2PolygonShape
            fixDef.shape.SetAsBox(size.width/2, size.height/2)

            bodyDef.position.x = position.x+rotated_x
            bodyDef.position.y = position.y+rotated_y

            var asteroid = world.CreateBody(bodyDef)
            asteroid.SetUserData({type:type_asteroid_child, piece:i, image:image})
            asteroid.CreateFixture(fixDef);
            asteroid.SetPositionAndAngle(bodyDef.position, angle)
            asteroid.ApplyForce(new b2Vec2((Math.random()-.5)*2600, (Math.random()-.5)*2600), bodyDef.position) // up
            asteroid.ApplyTorque((Math.random()-.5)*200)
        }
    }

    function createPlayer() {
        // make the player
        var fixDef = new b2FixtureDef
         fixDef.density = 1.0
         fixDef.friction = 0.5
         fixDef.restitution = 0.2

        var bodyDef = new b2BodyDef
        bodyDef.type = b2Body.b2_dynamicBody
        bodyDef.fixedRotation = true
        fixDef.shape = new b2PolygonShape
	
        var vertices = [new b2Vec2(.45, 0), new b2Vec2(-.25, .25), new b2Vec2(-.25, -.25)]
        var vertexCount = 3

        fixDef.shape.SetAsArray(vertices, vertexCount)
        bodyDef.position.x = canvas.width/2/30
        bodyDef.position.y = canvas.height/2/30
        var player = world.CreateBody(bodyDef)
        player.SetUserData({type:type_player_invulnerable})
        player.SetBullet(true)
        player.CreateFixture(fixDef)

        // the player starts out at invulnerable, but 
        // loses his shields after some time
        setTimeout(function() { 
                player.SetUserData({type:type_player}) 
        }, 5000)

        return  player
    }



    // keyboard
    var canFire = true
    var keysPressed = {}

    setInterval(function() { 
        canFire = true 

        if(keysPressed[32])
            fire()

        }, fire_repeat_rate)

    document.addEventListener("keydown", function(e) {
            var charCode = e.charCode? e.charCode : e.keyCode
		
            keysPressed[charCode] = true

            if(charCode == 32 && canFire) 
                fire()
    })

    document.addEventListener("keyup", function(e) {
            var charCode = e.charCode? e.charCode : e.keyCode

            keysPressed[charCode] = false
    })


    function fire() {
            canFire = false

            if(!player) return

            score += points_per_shot

            var angle = player.GetAngle()
            var position = player.GetPosition()
            var velocity = player.GetLinearVelocity()
            var x = Math.cos(angle)*2
            var y = Math.sin(angle)*2

            var fixDef = new b2FixtureDef
            fixDef.density = 1.0
            fixDef.friction = 0.5
            fixDef.restitution = 0.2
            fixDef.shape = new b2PolygonShape
            fixDef.shape.SetAsBox(.05, .05)

            var bodyDef = new b2BodyDef
            bodyDef.type = b2Body.b2_dynamicBody
            bodyDef.position.x = player.GetPosition().x+x/4
            bodyDef.position.y = player.GetPosition().y+y/4
	
            var bullet = world.CreateBody(bodyDef)
            bullet.CreateFixture(fixDef);
            bullet.SetBullet(true)
            bullet.SetUserData({type:type_bullet})
            bullet.SetLinearVelocity(new b2Vec2(velocity.x+x*5, velocity.y+y*5))

            player.ApplyForce(new b2Vec2((velocity.x+x)*-1, (velocity.y+y)*-1), player.GetPosition())
    }

    //update
    function update() {
            wrapPieces(world.GetBodyList())

            fireKeys(keysPressed)

            world.Step(1 / 60, 10, 10)
            world.DrawDebugData()
            world.ClearForces()

            drawImages()
            drawScore()
    }

    function drawImages() {
        var body = world.GetBodyList()

        while(body) {
            if(body.GetUserData() && body.GetUserData().type == type_asteroid) {
                var size = {width:3*30, height:4*30}
                var position = body.GetPosition()
                var image = body.GetUserData().image

                ctx.save()
                ctx.translate(position.x*30, position.y*30)
                ctx.rotate(body.GetAngle())
                ctx.translate(-position.x*30, -position.y*30)
                if(image) ctx.drawImage(image, position.x*30-size.width/2, position.y*30-size.height/2, size.width,size.height);
                ctx.restore()
            }

            if(body.GetUserData() && body.GetUserData().type == type_asteroid_child) {
                var size = {width:1.5*30, height:2*30}
                var position = body.GetPosition()
                var piece = body.GetUserData().piece
                var image = body.GetUserData().image

                var pos_x = (piece == 1 || piece == 2)? 0 : 1
                var pos_y = (piece == 0 || piece == 1)? 1 : 0

                ctx.save()
                ctx.translate(position.x*30, position.y*30)
                ctx.rotate(body.GetAngle())
                ctx.translate(-position.x*30, -position.y*30)
                if(image) ctx.drawImage(image, pos_x*image.width/2, pos_y*image.height/2, image.width/2, image.height/2, position.x*30-size.width/2, position.y*30-size.height/2, size.width, size.height)
                ctx.restore()
            }

            body = body.GetNext()
        }
    }

    function drawScore() {
        score = Math.max(score,0)
        ctx.fillStyle = "#FFF"
        ctx.font = "34px HelveticaNeue"
        ctx.fillText(pad(score, 7), canvas.width-200, 40)
    }

     function fireKeys(keysPressed) {
        if(!player) return

            // move the player
            var angle = player.GetAngle()
            var position = player.GetPosition()

            if(keysPressed[37])
                    player.SetPositionAndAngle(position, angle-.1) // left
            if(keysPressed[38])
                    player.ApplyForce(new b2Vec2(Math.cos(angle)*2, Math.sin(angle)*2), position) // up
            if(keysPressed[39]) 
                    player.SetPositionAndAngle(position, angle+.1) // right
            if(keysPressed[40]) ; // down

     }

     function wrapPieces(body) {
            var pos = {}
            var needsReposition = false
            var padding = 25 // in pixels

            while(body) {

                    // we're also removing destroyed bodies here, it doesn't fit with the function name
                    // but it prevents us from looping the bodies again on the same world tick
                    if(body.GetUserData() && body.GetUserData().type == type_dead) 
                        world.DestroyBody(body) 

                    if(body.GetUserData() && body.GetUserData().type == type_dead_asteroid) {
                        var image = body.GetUserData().image
                        createSmallAsteroids(image, body.GetPosition(), body.GetAngle())
                        world.DestroyBody(body)
                    }

                    needsReposition = false

                    pos = body.GetPosition()

                    if(pos.x*30 < 0-padding) {pos.x += (canvas.width + 2*padding)/30; needsReposition = true }
                    else if(pos.x*30 > canvas.width+padding) {pos.x -= (canvas.width + 2*padding)/30; needsReposition = true }

                    if(pos.y*30 < 0-padding) {pos.y += (canvas.height + 2*padding)/30; needsReposition = true }
                    else if(pos.y*30 > canvas.height+padding) {pos.y -= (canvas.height + 2*padding)/30; needsReposition = true }

                    if(needsReposition)
                            body.SetPositionAndAngle(new b2Vec2(pos.x, pos.y), body.GetAngle())
                
                    if(needsReposition && body.GetUserData().type == type_bullet) world.DestroyBody(body)

                    body = body.GetNext()
            }
     }

     function shouldEndGame() {
         if(player == null) return true

         var body = world.GetBodyList()
         while(body) {
             var type = body.GetUserData()? body.GetUserData().type : null

             if(type == type_asteroid || type == type_asteroid_child) return false

             body = body.GetNext()
         }

         return true
     }

     // helpers
    function pad(number, length) {
   
        var str = '' + number;
        while (str.length < length) {
            str = '0' + str;
        }
   
        return str;

    }
}
